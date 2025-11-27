/**
 * @title TMT
 * @description Trail-making test
 * @version 0.1.0
 *
 * @assets assets/
 */
// You can import stylesheets (.scss or .css).
import "../styles/main.scss";
import FullscreenPlugin from "@jspsych/plugin-fullscreen";
import InstructionsPlugin from "@jspsych/plugin-instructions";
import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import PreloadPlugin from "@jspsych/plugin-preload";
import { initJsPsych } from "jspsych";

/**
 * Standardiserade positioner för övning (1-8)
 * Skalad för Lenovo Tab M9 1340x800
 */
const PRACTICE_POSITIONS = [
  { x: 643, y: 391, number: 1, label: "START" },
  { x: 955, y: 95, number: 2 },
  { x: 1005, y: 321, number: 3 },
  { x: 1242, y: 436, number: 4 },
  { x: 975, y: 702, number: 5 },
  { x: 186, y: 672, number: 6 },
  { x: 81, y: 105, number: 7 },
  { x: 532, y: 147, number: 8, label: "SLUT" }
];

/**
 * Standardiserade positioner för test (1-25)
 * Roterad 90° och skalad för Lenovo Tab M9 1340x800
 */
const TEST_POSITIONS = [
  { x: 746, y: 229, number: 1, label: "START" },
  { x: 912, y: 394, number: 2 },
  { x: 1000, y: 164, number: 3 },
  { x: 497, y: 203, number: 4 },
  { x: 506, y: 456, number: 5 },
  { x: 619, y: 311, number: 6 },
  { x: 765, y: 471, number: 7 },
  { x: 981, y: 564, number: 8 },
  { x: 1150, y: 520, number: 9 },
  { x: 964, y: 464, number: 10 },
  { x: 1157, y: 278, number: 11 },
  { x: 1252, y: 649, number: 12 },
  { x: 639, y: 609, number: 13 },
  { x: 802, y: 636, number: 14 },
  { x: 130, y: 660, number: 15 },
  { x: 320, y: 594, number: 16 },
  { x: 118, y: 372, number: 17 },
  { x: 349, y: 394, number: 18 },
  { x: 220, y: 144, number: 19 },
  { x: 206, y: 295, number: 20 },
  { x: 114, y: 142, number: 21 },
  { x: 485, y: 114, number: 22 },
  { x: 1235, y: 100, number: 23 },
  { x: 715, y: 121, number: 24 },
  { x: 1150, y: 153, number: 25, label: "SLUT" }
];

/**
 * Custom jsPsych plugin för TMT med realtidsvalidering
 */
class CustomTMTPlugin {
  static info = {
    name: 'custom-tmt',
    parameters: {
      positions: { default: [] },
      canvas_width: { default: 1340 },
      canvas_height: { default: 800 },
      circle_radius: { default: 30 },
      is_practice: { default: false },
      circle_count: { default: 25 }
    }
  };

  constructor(jsPsych) {
    this.jsPsych = jsPsych;
  }

  trial(display_element, trial) {
    let startTime = performance.now();
      let currentCircle = 1;
      let isDrawing = false;
      let lastX = null;
      let lastY = null;
      let errors = 0;
      let strokes = [];
      let currentStroke = [];
      let liftOffEvents = []; // Track when user lifts finger
      
      // Skapa HTML
      const html = `
        <div id="tmt-container" style="text-align: center;">
          <div id="tmt-prompt" style="margin-bottom: 20px;">
            <p><strong>${trial.is_practice ? 'ÖVNING' : 'TEST'}</strong></p>
            <p>Dra ett streck från 1 och framåt i stigande ordning (1-2-3 osv.)</p>
            <p id="error-message" style="color: red; min-height: 20px; font-weight: bold;"></p>
          </div>
          <canvas id="tmt-canvas" width="${trial.canvas_width}" height="${trial.canvas_height}" 
                  style="border: 2px solid black; background-color: #f0f0f0; touch-action: none; cursor: crosshair;">
          </canvas>
          <div style="margin-top: 10px; color: #666; font-size: 14px;">
            <p>Antal lyft: <span id="lift-count">0</span></p>
          </div>
        </div>
      `;
      
      display_element.innerHTML = html;
      
      const canvas = document.getElementById('tmt-canvas');
      const ctx = canvas.getContext('2d');
      const errorMessage = document.getElementById('error-message');
      const liftCountSpan = document.getElementById('lift-count');
      
      // Rita cirklar
      function drawCircles() {
        trial.positions.forEach((pos, idx) => {
          // Rita cirkel
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, trial.circle_radius, 0, 2 * Math.PI);
          ctx.fillStyle = pos.number < currentCircle ? '#ccffcc' : '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Rita nummer
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 20px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pos.number.toString(), pos.x, pos.y);
          
          // Rita START/SLUT etiketter
          if (pos.label) {
            ctx.font = 'bold 14px Arial';
            ctx.fillText(pos.label, pos.x, pos.y - trial.circle_radius - 15);
          }
        });
      }
      
      // Kontrollera om punkt är i cirkel
      function isPointInCircle(px, py, circle) {
        const dx = px - circle.x;
        const dy = py - circle.y;
        return Math.sqrt(dx * dx + dy * dy) <= trial.circle_radius;
      }
      
      // Hämta canvas-koordinater från event
      function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        };
      }
      
      // Rita linje
      function drawLine(x1, y1, x2, y2) {
        ctx.strokeStyle = '#0066cc';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      
      // Rita alla streck på nytt
      function redrawAll() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCircles();
        
        // Rita alla tidigare streck
        strokes.forEach(stroke => {
          for (let i = 1; i < stroke.length; i++) {
            drawLine(stroke[i-1].x, stroke[i-1].y, stroke[i].x, stroke[i].y);
          }
        });
        
        // Rita nuvarande streck
        for (let i = 1; i < currentStroke.length; i++) {
          drawLine(currentStroke[i-1].x, currentStroke[i-1].y, currentStroke[i].x, currentStroke[i].y);
        }
      }
      
      // Börja rita
      function startDrawing(e) {
        e.preventDefault();
        const coords = getCanvasCoords(e);
        
        // If we haven't started yet, must start from circle 1
        if (strokes.length === 0) {
          const targetCircle = trial.positions.find(p => p.number === 1);
          if (isPointInCircle(coords.x, coords.y, targetCircle)) {
            isDrawing = true;
            lastX = coords.x;
            lastY = coords.y;
            currentStroke = [{ x: lastX, y: lastY, timestamp: performance.now() }];
            errorMessage.textContent = '';
          } else {
            errorMessage.textContent = 'Vänligen börja från cirkel 1 (START)';
            errors++;
          }
        } else {
          // After lifting, must continue from near the last drawn point
          const lastStroke = strokes[strokes.length - 1];
          const lastPoint = lastStroke[lastStroke.length - 1];
          const distance = Math.sqrt(
            Math.pow(coords.x - lastPoint.x, 2) + 
            Math.pow(coords.y - lastPoint.y, 2)
          );
          
          // Allow starting within reasonable distance of last point (e.g., 50px)
          if (distance < 50) {
            isDrawing = true;
            lastX = coords.x;
            lastY = coords.y;
            currentStroke = [{ x: lastX, y: lastY, timestamp: performance.now() }];
            errorMessage.textContent = '';
          } else {
            errorMessage.textContent = 'Fortsätt från där du slutade';
            errors++;
          }
        }
      }
      
      // Fortsätt rita
      function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        
        const coords = getCanvasCoords(e);
        drawLine(lastX, lastY, coords.x, coords.y);
        currentStroke.push({ x: coords.x, y: coords.y, timestamp: performance.now() });
        
        // Kontrollera om vi nått nästa cirkel
        const targetCircle = trial.positions.find(p => p.number === currentCircle);
        if (isPointInCircle(coords.x, coords.y, targetCircle)) {
          currentCircle++;
          
          // Rita om allt för att visa framsteg
          redrawAll();
          
          // Kontrollera om klart
          if (currentCircle > trial.circle_count) {
            endTrial();
            return;
          }
        }
        
        lastX = coords.x;
        lastY = coords.y;
      }
      
      // Sluta rita (lyft finger)
      function stopDrawing(e) {
        if (isDrawing) {
          e.preventDefault();
          isDrawing = false;
          strokes.push([...currentStroke]);
          
          // Registrera lift-off händelse
          liftOffEvents.push({
            timestamp: performance.now(),
            position: { x: lastX, y: lastY },
            currentTarget: currentCircle
          });
          
          // Uppdatera räknare
          liftCountSpan.textContent = liftOffEvents.length;
          
          currentStroke = [];
        }
      }
      
      // Avsluta test
      const endTrial = () => {
        const endTime = performance.now();
        const completionTime = endTime - startTime;
        
        // Ta bort eventlyssnare
        canvas.removeEventListener('mousedown', startDrawing);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', stopDrawing);
        canvas.removeEventListener('touchstart', startDrawing);
        canvas.removeEventListener('touchmove', draw);
        canvas.removeEventListener('touchend', stopDrawing);
        
        // Spara data
        const trialData = {
          trial_type: trial.is_practice ? 'practice' : 'test',
          trial_name: trial.is_practice ? 'övning' : 'test',
          circle_count: trial.circle_count,
          completion_time_ms: completionTime,
          completion_time_seconds: (completionTime / 1000).toFixed(2),
          strokes_count: strokes.length,
          lift_count: liftOffEvents.length,
          errors: errors,
          positions: trial.positions,
          strokes: strokes,
          lift_events: liftOffEvents
        };
        
        this.jsPsych.finishTrial(trialData);
      };
      
      // Lägg till eventlyssnare
      canvas.addEventListener('mousedown', startDrawing);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', stopDrawing);
      canvas.addEventListener('mouseleave', stopDrawing);
      
      // Touch-events
      canvas.addEventListener('touchstart', startDrawing);
      canvas.addEventListener('touchmove', draw);
      canvas.addEventListener('touchend', stopDrawing);
      
      // Initial ritning
      drawCircles();
    }
}

/**
 * Skapa TMT-test med standardiserade positioner
 */
function createTMTTrial(isPractice = false) {
  const positions = isPractice ? PRACTICE_POSITIONS : TEST_POSITIONS;
  
  return {
    type: CustomTMTPlugin,
    positions: positions,
    canvas_width: 1340,
    canvas_height: 800,
    circle_radius: 30,
    is_practice: isPractice,
    circle_count: positions.length
  };
}

/**
 * Huvudfunktion för experimentet
 */
export async function run({ assetPaths, input = {}, environment, title, version }) {
  const jsPsych = initJsPsych({
    on_finish: function() {
      // Spara data som JSON-fil
      jsPsych.data.get().localSave('json', 'tmt-results.json');
    }
  });
  
  const timeline = [];

  // Förladdning av tillgångar
  timeline.push({
    type: PreloadPlugin,
    images: assetPaths.images,
    audio: assetPaths.audio,
    video: assetPaths.video,
  });

  // Auto-enter fullscreen immediately (no pause screen)
  timeline.push({
    type: FullscreenPlugin,
    fullscreen_mode: true,
    delay_after: 0
  });

  // Instruktioner (samma stil som NBack med InstructionsPlugin)
  timeline.push({
    type: InstructionsPlugin,
    pages: [
      `<div style="max-width: 800px; margin: auto; color: white;">
        <h1>Trail Making Test - Del A</h1>
        <p style="font-size: 1.2em;">Välkommen till Trail Making Test!</p>
        <p>I detta test kommer du att se cirklar med siffror.</p>
        <p>Din uppgift är att förbinda cirklarna i nummerordning (1-2-3-4 osv.) genom att rita en kontinuerlig linje.</p>
      </div>`,
      `<div style="max-width: 800px; margin: auto; color: white;">
        <h2>Instruktioner</h2>
        <p>• Rita ett streck från cirkel 1 till cirkel 2, sedan till cirkel 3, och så vidare.</p>
        <p>• Försök att inte lyfta fingret/pennan från skärmen.</p>
        <p>• Om du lyfter fingret, fortsätt från där du slutade.</p>
        <p>• Arbeta så snabbt och noggrant som möjligt.</p>
      </div>`,
      `<div style="max-width: 800px; margin: auto; color: white;">
        <h2>Övning</h2>
        <p>Vi börjar med en kort övning med 8 cirklar.</p>
        <p>Detta är för att du ska bekanta dig med uppgiften.</p>
        <p>Redo? Tryck "Nästa" för att börja övningen.</p>
      </div>`
    ],
    show_clickable_nav: true,
    button_label_previous: "Föregående",
    button_label_next: "Nästa",
    on_finish: function() {
      const displayEl = jsPsych.getDisplayElement();
      displayEl.innerHTML = "";
    }
  });

  // Övning (1-8)
  timeline.push(createTMTTrial(true));

  // Instruktioner för huvudtest
  timeline.push({
    type: InstructionsPlugin,
    pages: [
      `<div style="max-width: 800px; margin: auto; color: white;">
        <h2>Bra jobbat!</h2>
        <p>Nu ska du göra det riktiga testet.</p>
        <p>Den här gången finns det fler cirklar (1-25).</p>
        <p><strong>Kom ihåg:</strong> Förbind dem i ordning så snabbt och noggrant som möjligt.</p>
        <p>Din tid kommer att registreras.</p>
      </div>`
    ],
    show_clickable_nav: true,
    button_label_previous: "Föregående",
    button_label_next: "Nästa",
    on_finish: function() {
      const displayEl = jsPsych.getDisplayElement();
      displayEl.innerHTML = "";
    }
  });

  // Huvudtest (1-25)
  timeline.push(createTMTTrial(false));

  // Slutskärm (med button istället för keyboard)
  timeline.push({
    type: HtmlButtonResponsePlugin,
    stimulus: `<div style="max-width: 800px; margin: auto; text-align: center; color: white;">
      <h2>Nu är du färdig med testet!</h2>
      <p style="margin-top: 30px; font-size: 1.2em;">Tack för ditt deltagande!</p>
    </div>`,
    choices: ['Avsluta'],
    margin_vertical: '40px'
  });

  await jsPsych.run(timeline);

  return jsPsych;
}
