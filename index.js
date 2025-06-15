//@ts-check
// Story-based first date simulator with clickable choices

// Assuming you've kept the charm/ending system from my previous large update:
let charm = 50; 
const MAX_CHARM_HEARTS = 3; 
const CHARM_SUCCESS_THRESHOLD = 80; 
const CHARM_FAILURE_THRESHOLD = 20;

let messageHistory = {
    response_format: { type: 'json_object' },
    messages: [
        {
            role: 'system',
            content: `
            You are a first date simulator. You tell a story from third person perspective about a date. Based on the user's choices, you change the plot of the story accordingly.
            Your goal is to simulate a realistic date where choices have consequences on the 'charm' level with your date.
            You refer to your date as "them". They are initially reserved but appreciates honesty and a good sense of humor. They have typical human-like behaviour and react according to your decisions sensitively. They are put off by rudeness or excessive arrogance and you lose charm points faster if you make negative remarks.

            IMPORTANT: You must respond in JSON format with this exact structure.
            The 'charmChange' value should reflect how the user's last choice impacted the date's likability.
            The 'gameEnd' and 'endingType' are optional and should only be included when the date reaches a natural conclusion (very good or very bad).

            {
                "story": "The story text describing what happens next...",
                "choices": ["Choice 1 text", "Choice 2 text", "Choice 3 text", "Choice 4 text"],
                "charmChange": 0, // Integer value: positive for good choices (e.g., 5 to 15), negative for bad (e.g., -5 to -15), 0 for neutral.
                "gameEnd": false, // Optional: true if the date naturally concludes (e.g., 3-5 turns in, or when a major event happens)
                "endingType": "" // Optional: "success", "failure", "funny", "neutral" etc. Only include if gameEnd is true.
            }

            - Keep story text direct and sharp but with enough details (2-4 sentences max).
            - Always provide exactly 4 different choices for what to do next.
            - Make choices varied: one option is romantic, one is random and weird, the third one is rude, the fourth is something neutral.
            - Respond based on the choice made: if they choose to be rude, the date responds with irritation and charm decreases. If they flirt, the date might go well and charm increases.
            - Include some "special move" type unexpected options.
            - Tell the story from third person perspective, not as dialogue. Use "you" and "them".
			- Also don't give them names
            - Do not include direct charm values in the story text, only describe the date's reactions and the atmosphere.
            - The date should last around 5-8 turns before a natural conclusion is prompted via 'gameEnd'.
			-randomize the date locations every refresh. be creative. Not only café or restaurant.
			NO NAMES!!!!!
			- NO ALEX!!!!!!!
            - make sure that the decisions decide the fate and the charm-points of the story
            - make it more dramatic, not as boring!
            - make a conclusion after 8 rounds!
            be strict with the mood of the options. one always has to be rude or negative, the second has to be weird and unexpected, the third is romantic and the last one neutral
            - all moods have to be different and vary in the game
        

            `,
        },
    ],
};

// TODO: use your own val.town endpoint
// remix: https://val.town/remix/ff6347-openai-api
const apiEndpoint = 'https://nicolesophie--5a1dc17f24494298aa2e650b67aa388e.web.val.run';
if (!apiEndpoint.includes('run')) {
    throw new Error('Please use your own val.town endpoint!!!');
}

const MAX_HISTORY_LENGTH = 10; 

// DOM Elements - Get references once the DOM is ready
const storyTextElement = document.querySelector('.story-text');
const choicesGridElement = document.querySelector('.choices-grid');
const startButton = document.querySelector('#start-story');
const charmScoreElement = document.querySelector('#charm-score');
const pixelHeartsContainer = document.querySelector('#pixel-hearts-container');
const gameOverScreen = document.querySelector('#game-over-screen');
const endingTitleElement = document.querySelector('#ending-title');
const endingMessageElement = document.querySelector('#ending-message');
const playAgainButton = document.querySelector('#play-again-button');
const gameMainElement = document.querySelector('.game-main'); 
const gameHeaderElement = document.querySelector('.game-header');

// New: Music elements
const backgroundMusic = document.querySelector('#background-music');
const musicToggleButton = document.querySelector('#music-toggle');


document.addEventListener('DOMContentLoaded', () => {
    // Robust checks to ensure all elements are found before proceeding
    if (!storyTextElement) throw new Error('Could not find element .story-text');
    if (!choicesGridElement) throw new Error('Could not find element .choices-grid');
    if (!startButton) throw new Error('Could not find start button');
    if (!charmScoreElement) throw new Error('Could not find element #charm-score');
    if (!pixelHeartsContainer) throw new Error('Could not find element #pixel-hearts-container');
    if (!gameOverScreen) throw new Error('Could not find element #game-over-screen');
    if (!endingTitleElement) throw new Error('Could not find element #ending-title');
    if (!endingMessageElement) throw new Error('Could not find element #ending-message');
    if (!playAgainButton) throw new Error('Could not find element #play-again-button');
    if (!gameMainElement) throw new Error('Could not find element .game-main');
    if (!gameHeaderElement) throw new Error('Could not find element .game-header');
    
    // New: Music element checks
    if (!backgroundMusic) throw new Error('Could not find audio element #background-music');
    if (!musicToggleButton) throw new Error('Could not find button #music-toggle');


    // Initial UI update to show charm and hearts when the page loads
    updateCharmDisplay();

    // Event listener for the start game button
    startButton.addEventListener('click', async () => {
        // Play music when the game starts
        if (backgroundMusic.paused) {
            try {
                await backgroundMusic.play();
                musicToggleButton.textContent = '♪ ON';
                musicToggleButton.classList.remove('off');
            } catch (error) {
                console.error("Autoplay prevented:", error);
                // Inform user or handle (e.g., keep muted until user interacts)
            }
        }
        await startStory();
    });

    // Event listener for the play again button on the game over screen
    playAgainButton.addEventListener('click', resetGame);

    // New: Music toggle button event listener
    musicToggleButton.addEventListener('click', () => {
        if (backgroundMusic.paused) {
            backgroundMusic.play()
                .then(() => {
                    musicToggleButton.textContent = '♪ ON';
                    musicToggleButton.classList.remove('off');
                })
                .catch(error => console.error("Play prevented by browser:", error));
        } else {
            backgroundMusic.pause();
            musicToggleButton.textContent = '♪ OFF';
            musicToggleButton.classList.add('off');
        }
    });
});

async function startStory() {
    charm = 50; 
    updateCharmDisplay(); 

    startButton.classList.add('hidden');
    storyTextElement.innerHTML = '<div class="loading">Starting your date story...</div>';
    
    messageHistory.messages = [
        messageHistory.messages[0], 
        { 
            role: 'user', 
            content: 'Start a first date story. Set the scene and give me choices for what to do. The initial charm level is 50.' 
        }
    ];
    
    await generateStoryAndChoices();
}

async function makeChoice(choiceText) {
    const allButtons = choicesGridElement.querySelectorAll('.choice-button');
    allButtons.forEach(button => button.disabled = true);
    
    storyTextElement.innerHTML += '<div class="loading">Making your choice...</div>';
    
    messageHistory.messages.push({ role: 'user', content: choiceText });
    messageHistory = truncateHistory(messageHistory);
    
    await generateStoryAndChoices();
}

async function generateStoryAndChoices() {
    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(messageHistory),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const json = await response.json();
        console.log('API Response:', json);
        
        let storyData;
        
        if (json.completion && json.completion.choices && json.completion.choices[0]) {
            const content = json.completion.choices[0].message.content;
            storyData = JSON.parse(content);
        } else if (json.choices && json.choices[0]) {
            const content = json.choices[0].message.content;
            storyData = JSON.parse(content);
        } else if (json.content) {
            storyData = JSON.parse(json.content);
        } else {
            storyData = json;
        }
        
        if (typeof storyData.charmChange === 'number') {
            charm += storyData.charmChange;
            charm = Math.max(0, Math.min(100, charm));
            updateCharmDisplay();
        }

        messageHistory.messages.push({
            role: 'assistant',
            content: JSON.stringify(storyData)
        });
        messageHistory = truncateHistory(messageHistory);
        
        if (storyData.gameEnd || charm <= CHARM_FAILURE_THRESHOLD || charm >= CHARM_SUCCESS_THRESHOLD) {
            endGame(storyData.endingType || determineEndingType(charm));
        } else {
            updateStoryDisplay(storyData.story, storyData.choices);
        }
        
    } catch (error) {
        console.error('Error in generateStoryAndChoices:', error);
        storyTextElement.innerHTML = `<div style="color: red;">Error: ${error.message}<br>Could not load story. Please try again.</div>`;
        
        choicesGridElement.innerHTML = ''; 
        const restartButton = document.createElement('button');
        restartButton.className = 'start-button pixel-button'; 
        restartButton.textContent = 'RESTART GAME';
        restartButton.addEventListener('click', resetGame);
        choicesGridElement.appendChild(restartButton);
    }
}

function updateStoryDisplay(storyText, choices) {
    const newStoryParagraph = document.createElement('p');
    newStoryParagraph.textContent = storyText;
    
    storyTextElement.innerHTML = '';
    storyTextElement.appendChild(newStoryParagraph);
    
    updateChoiceButtons(choices);
    
    storyTextElement.scrollTop = storyTextElement.scrollHeight;
}

function updateChoiceButtons(choices) {
    choicesGridElement.innerHTML = '';
    
    choices.forEach((choice) => {
        const button = document.createElement('button');
        button.className = 'choice-button';
        button.textContent = choice;
        button.addEventListener('click', () => makeChoice(choice));
        choicesGridElement.appendChild(button);
    });
}

function updateCharmDisplay() {
    if (charmScoreElement) {
        charmScoreElement.textContent = charm.toString();
    }
    
    if (pixelHeartsContainer) {
        pixelHeartsContainer.innerHTML = ''; 
        const heartsToShow = Math.ceil((charm / 100) * MAX_CHARM_HEARTS); 

        for (let i = 0; i < MAX_CHARM_HEARTS; i++) {
            const heart = document.createElement('span');
            heart.className = 'heart';
            heart.textContent = '♥'; 
            if (i >= heartsToShow) {
                heart.classList.add('empty'); 
            }
            pixelHeartsContainer.appendChild(heart);
        }
    }
}

function truncateHistory(h) {
    if (!h || !h.messages || h.messages.length <= 1) {
        return h; 
    }
    const { messages } = h;
    const [system, ...rest] = messages; 
    if (rest.length > MAX_HISTORY_LENGTH) {
        return { 
            ...h,
            messages: [system, ...rest.slice(-MAX_HISTORY_LENGTH)]
        };
    } else {
        return h; 
    }
}

function determineEndingType(finalCharm) {
    if (finalCharm >= CHARM_SUCCESS_THRESHOLD) {
        return 'success';
    } else if (finalCharm <= CHARM_FAILURE_THRESHOLD) {
        return 'failure';
    } else {
        return 'neutral';
    }
}

async function endGame(endingType) {
    gameMainElement.classList.add('hidden');
    gameHeaderElement.classList.add('hidden');

    gameOverScreen.classList.remove('hidden');

    let title = '';
    let message = '';

    switch (endingType) {
        case 'success':
            title = 'Date Successful!';
            message = 'You both really hit it off! Sparks flew, and it looks like a second date is definitely in the cards. Congratulations on finding love!';
            break;
        case 'failure':
            title = 'Date Failed!';
            message = 'The date ended abruptly, leaving a bitter taste. It seems you both were not meant to be. Perhaps love is a battlefield after all...';
            break;
        case 'funny':
            title = 'What Just Happened?!';
            message = 'The date took an unexpected and hilarious turn! While it might not be true love, it was certainly memorable. You both had a good laugh.';
            break;
        case 'neutral':
        default:
            title = 'Date Concluded';
            message = 'The date came to a polite, if uneventful, end. No fireworks, no disasters. Just another day in the dating world. Maybe next time!';
            break;
    }

    endingTitleElement.textContent = title;
    endingMessageElement.textContent = message;
    
    // Pause music when game ends
    if (!backgroundMusic.paused) {
        backgroundMusic.pause();
        musicToggleButton.textContent = '♪ OFF';
        musicToggleButton.classList.add('off');
    }
}

function resetGame() {
    charm = 50;
    messageHistory.messages = [messageHistory.messages[0]];

    gameMainElement.classList.remove('hidden');
    gameHeaderElement.classList.remove('hidden');

    gameOverScreen.classList.add('hidden');

    storyTextElement.innerHTML = '<div class="intro-text">Welcome to First Date RPG!<br><br>Your romantic adventure awaits...<br><br>Press START to begin your quest for love!</div>';
    choicesGridElement.innerHTML = ''; 

    startButton.classList.remove('hidden');

    updateCharmDisplay();
}