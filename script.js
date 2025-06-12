document.addEventListener('DOMContentLoaded', () => {

    // === DOM ELEMENTEN ===
    const atomCanvas = document.getElementById('atom-canvas');
    const atomCtx = atomCanvas.getContext('2d');
    const isotopeInfoEl = document.getElementById('isotope-info');
    const graphCanvas = document.getElementById('graph-canvas');
    const graphCtx = graphCanvas.getContext('2d');
    const actionButton = document.getElementById('action-button');
    const feedbackText = document.getElementById('feedback-text');
    const museumGallery = document.getElementById('museum-gallery');
    const scoreDisplay = document.getElementById('score-display');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const modalExtraContent = document.getElementById('modal-extra-content');
    const modalButton = document.getElementById('modal-button');

    // === SPELCONFIGURATIE ===
    // Halfwaardetijden zijn verkort voor snellere gameplay
    const ATOM_COUNT = 100;
    const ATOM_RADIUS = 5;
    const levels = [
        { 
            artifactName: "Oud Hout", isotopeName: "Koolstof-14", realHalfLife: "5730 jaar", halfLifeInSeconds: 4,
            question: { text: "Koolstof-14 wordt gebruikt om organisch materiaal te dateren. Hoeveel procent is er nog over na 2 halfwaardetijden?", options: ["50%", "12.5%", "25%"], answer: "25%" } 
        },
        { 
            artifactName: "Vulkanisch Gesteente", isotopeName: "Kalium-40", realHalfLife: "1,25 miljard jaar", halfLifeInSeconds: 3,
            question: { text: "Kalium-40 vervalt heel langzaam. Hoeveel procent is er nog over na 3 halfwaardetijden?", options: ["25%", "12.5%", "10%"], answer: "12.5%" } 
        },
        { 
            artifactName: "Medisch Instrument", isotopeName: "Technetium-99m", realHalfLife: "6 uur", halfLifeInSeconds: 6,
            question: { text: "Technetium-99m wordt in ziekenhuizen gebruikt. Wat is de activiteit na 4 halfwaardetijden?", options: ["6.25%", "12.5%", "5%"], answer: "6.25%" } 
        },
        { 
            artifactName: "Meteoriet", isotopeName: "Aluminium-26", realHalfLife: "717.000 jaar", halfLifeInSeconds: 5,
            question: { text: "Aluminium-26 helpt bij het dateren van meteorieten. Na hoeveel halfwaardetijden is er nog maar 50% over?", options: ["2", "0.5", "1"], answer: "1" } 
        },
        { 
            artifactName: "Oude Rotsformatie", isotopeName: "Uranium-238", realHalfLife: "4,5 miljard jaar", halfLifeInSeconds: 2.5,
            question: { text: "Uranium-238 wordt gebruikt om de aarde zelf te dateren. Welk percentage is er na één halfwaardetijd vervallen?", options: ["50%", "100%", "25%"], answer: "50%" } 
        }
    ];

    // === SPELTOESTAND (STATE) ===
    let atoms = [], graphData = [], discoveredObjects = [];
    let time = 0, lastTime = 0, score = 0, questionTries = 0;
    let isPaused = true, animationFrameId;
    let currentLevelIndex = -1; // Start op -1 zodat het eerste level correct wordt geïnitialiseerd
    let gameState = 'welcome'; 

    // === MODAL FUNCTIES ===
    function showModal(config) {
        modalTitle.textContent = config.title;
        modalText.innerHTML = config.text;
        modalButton.textContent = config.buttonText;
        modalButton.onclick = config.buttonAction;
        modalExtraContent.innerHTML = config.extraContent || '';
        modalButton.classList.toggle('hidden', !config.buttonText);
        modalBackdrop.classList.remove('hidden');
    }

    function showWelcomeModal() {
        showModal({
            title: "Welkom bij de Halfwaardetijd Helper!",
            text: "Ik ben Professor Nova! Ik heb jouw hulp nodig om een kist vol oeroude artefacten te dateren. Laten we samen de geheimen van radioactief verval ontdekken. Ben je er klaar voor?",
            buttonText: "Start het Avontuur!",
            buttonAction: () => {
                modalBackdrop.classList.add('hidden');
                nextLevel(); // Start het eerste level
            }
        });
    }
    
    // === INITIALISATIE & SPEL FLOW ===
    function initLevel(levelIndex) {
        currentLevelIndex = levelIndex;
        const level = levels[currentLevelIndex];
        
        isotopeInfoEl.textContent = `Isotoop: ${level.isotopeName} (Echte T½: ${level.realHalfLife})`;
        
        time = 0; atoms = []; graphData = [];
        isPaused = true; questionTries = 0;
        gameState = 'initial';

        for (let i = 0; i < ATOM_COUNT; i++) {
            atoms.push({ x: Math.random() * atomCanvas.width, y: Math.random() * atomCanvas.height, radius: ATOM_RADIUS, isRadioactive: true, decaying: 0 });
        }
        
        actionButton.textContent = 'Start Simulatie';
        actionButton.disabled = false;
        feedbackText.textContent = `Het artefact is een ${level.artifactName}. Klik 'Start Simulatie' om te beginnen.`;
        
        draw();
    }
    
    actionButton.addEventListener('click', () => {
        if (gameState === 'initial') {
            isPaused = false;
            gameState = 'observing';
            actionButton.textContent = 'Pauzeer Simulatie';
            feedbackText.textContent = "De simulatie loopt... Klik nogmaals om te pauzeren en de halfwaardetijd te bepalen.";
            lastTime = performance.now();
        } else if (gameState === 'observing') {
            isPaused = true;
            gameState = 'determining';
            actionButton.disabled = true;
            feedbackText.textContent = 'De simulatie is gepauzeerd. Klik op de grafiek om de halfwaardetijd te bepalen.';
        } else if (gameState === 'level_complete') {
            nextLevel();
        }
    });

    // === GRAFIEK INTERACTIE ===
    graphCanvas.addEventListener('click', e => {
        if (gameState !== 'determining') return;
        const rect = graphCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const padding = 40;
        const graphWidth = graphCanvas.width - 2 * padding;
        
        if (x >= padding && x <= graphCanvas.width - padding) {
            const maxTime = Math.max(levels[currentLevelIndex].halfLifeInSeconds * 3, time);
            const clickedTime = ((x - padding) / graphWidth) * maxTime;
            const halfLife = levels[currentLevelIndex].halfLifeInSeconds;

            if (Math.abs(clickedTime - halfLife) < 2.0) { // Tolerantie van 2.0s
                const timePoints = Math.max(100, 1000 - Math.floor(time * 20));
                updateScore(timePoints);

                feedbackText.innerHTML = `Uitstekend! De halfwaardetijd is inderdaad rond <strong>${halfLife.toFixed(1)}s</strong>. <br>Je verdient ${timePoints} punten! Nu de controle-vraag.`;
                actionButton.disabled = true;
                gameState = 'applying';
                setTimeout(askQuestion, 1500);
            } else {
                updateScore(-50); // Strafpunten
                feedbackText.textContent = `Bijna! Je gok van ${clickedTime.toFixed(1)}s is niet correct. Probeer de lijn preciezer op de 50-atomen-lijn te plaatsen. (-50 punten)`;
            }
        }
    });

    function askQuestion() {
        const level = levels[currentLevelIndex];
        const question = level.question;
        
        let optionsHtml = '';
        question.options.forEach(option => {
            optionsHtml += `<button onclick="window.checkAnswer('${option}', this)">${option}</button>`;
        });

        showModal({
            title: 'Controlevraag',
            text: question.text,
            buttonText: null, // Geen hoofdknop nodig
            extraContent: `<div id="mc-options">${optionsHtml}</div><div class="mc-feedback"></div>`
        });
    }

    window.checkAnswer = (selectedOption, buttonEl) => {
        questionTries++;
        const level = levels[currentLevelIndex];
        const optionsContainer = document.getElementById('mc-options');
        const feedbackEl = document.querySelector('.mc-feedback');
        
        Array.from(optionsContainer.children).forEach(btn => btn.disabled = true);

        if (selectedOption === level.question.answer) {
            buttonEl.classList.add('correct-answer');
            feedbackEl.textContent = "Correct!";
            feedbackEl.style.color = 'var(--success-color)';
            if(questionTries === 1) { updateScore(500); }
            
            setTimeout(() => {
                modalBackdrop.classList.add('hidden');
                gameState = 'level_complete';
                actionButton.disabled = false;
                actionButton.textContent = currentLevelIndex >= levels.length - 1 ? "Bekijk Eindscore" : 'Volgend Artefact';
                addToMuseum(level.artifactName);
            }, 1500);
        } else {
            buttonEl.classList.add('wrong-answer');
            feedbackEl.textContent = "Helaas, dat is niet juist.";
            feedbackEl.style.color = 'var(--error-color)';
            updateScore(-25);
            setTimeout(() => {
                buttonEl.classList.remove('wrong-answer');
                feedbackEl.textContent = "";
                Array.from(optionsContainer.children).forEach(btn => btn.disabled = false);
            }, 1500);
        }
    }

    function nextLevel() {
        if (currentLevelIndex < levels.length - 1) {
            initLevel(currentLevelIndex + 1);
        } else {
            gameState = 'end';
            showModal({
                title: "Avontuur Voltooid!",
                text: `Fantastisch werk! Je hebt alle artefacten succesvol gedateerd. Jouw indrukwekkende eindscore is: <strong>${score}</strong>!`,
                buttonText: "Speel opnieuw",
                buttonAction: () => window.location.reload()
            });
        }
    }

    // === CANVAS & UPDATE LOGICA ===
    function gameLoop(timestamp) {
        animationFrameId = requestAnimationFrame(gameLoop);
        if (isPaused || gameState === 'end') {
            lastTime = timestamp;
            return;
        }

        const deltaTime = (timestamp - lastTime) / 1000;
        time += deltaTime;
        lastTime = timestamp;

        updateAtoms(deltaTime);
        const activeAtoms = atoms.filter(a => a.isRadioactive).length;
        if(graphData.length === 0 || time - graphData[graphData.length-1].time > 0.1) {
            graphData.push({ time: time, atoms: activeAtoms });
        }
        
        draw();
    }

    function updateAtoms(deltaTime) {
        const level = levels[currentLevelIndex];
        const decayProbability = 1 - Math.pow(2, -deltaTime / level.halfLifeInSeconds);
        atoms.forEach(atom => {
            if (atom.isRadioactive && Math.random() < decayProbability) {
                atom.isRadioactive = false;
                atom.decaying = 1;
            }
        });
    }

    function draw() {
        drawAtoms();
        drawGraph();
    }
    
    function drawAtoms() {
        atomCtx.clearRect(0, 0, atomCanvas.width, atomCanvas.height);
        atoms.forEach(atom => {
            if(atom.radius <= 0) return;
            atomCtx.beginPath();
            atomCtx.arc(atom.x, atom.y, atom.radius, 0, Math.PI * 2);
            if (atom.decaying > 0) {
                atomCtx.fillStyle = `rgba(141, 153, 174, ${atom.decaying})`;
                atom.radius -= 0.2;
                atom.decaying -= 0.05;
            } else {
                atomCtx.fillStyle = atom.isRadioactive ? 'var(--atom-radioactive)' : 'var(--atom-stable)';
            }
            atomCtx.fill();
        });
    }

    function drawGraph() {
        graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
        const padding = 40;
        const graphWidth = graphCanvas.width - 2 * padding;
        const graphHeight = graphCanvas.height - 2 * padding;

        graphCtx.beginPath();
        graphCtx.moveTo(padding, padding);
        graphCtx.lineTo(padding, graphCanvas.height - padding);
        graphCtx.lineTo(graphCanvas.width - padding, graphCanvas.height - padding);
        graphCtx.strokeStyle = '#333';
        graphCtx.stroke();

        graphCtx.fillStyle = '#333';
        graphCtx.textAlign = 'center';
        graphCtx.font = "12px Poppins";
        graphCtx.fillText("Tijd (s)", padding + graphWidth / 2, graphCanvas.height - 10);
        graphCtx.save();
        graphCtx.translate(15, padding + graphHeight / 2);
        graphCtx.rotate(-Math.PI / 2);
        graphCtx.fillText("Atomen (%)", 0, 0);
        graphCtx.restore();

        graphCtx.textAlign = 'right';
        graphCtx.fillText("100", padding - 5, padding + 5);
        graphCtx.fillText("50", padding - 5, padding + graphHeight / 2 + 5);
        graphCtx.fillText("0", padding - 5, padding + graphHeight + 5);
        
        if (graphData.length > 1) {
            graphCtx.beginPath();
            graphCtx.strokeStyle = 'var(--primary-color)';
            graphCtx.lineWidth = 3;
            const maxTime = Math.max(levels[currentLevelIndex].halfLifeInSeconds * 3, time);
            
            graphData.forEach((point, i) => {
                const x = padding + (point.time / maxTime) * graphWidth;
                const y = padding + (1 - point.atoms / ATOM_COUNT) * graphHeight;
                if (i === 0) graphCtx.moveTo(x, y);
                else graphCtx.lineTo(x, y);
            });
            graphCtx.stroke();
        }
    }
    
    // === HULPFUNCTIES ===
    function updateScore(points) {
        score = Math.max(0, score + points); // Zorg dat de score niet negatief wordt
        scoreDisplay.textContent = `Score: ${score}`;
    }
    
    function addToMuseum(objectName) {
        if (!discoveredObjects.includes(objectName)) {
            discoveredObjects.push(objectName);
            const item = document.createElement('div');
            item.className = 'museum-item';
            item.textContent = objectName;
            museumGallery.appendChild(item);
        }
    }

    // === START HET SPEL ===
    showWelcomeModal();
    animationFrameId = requestAnimationFrame(gameLoop);
});
