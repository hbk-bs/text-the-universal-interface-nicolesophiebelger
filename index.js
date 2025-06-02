//@ts-check

let messageHistory = {
	response_format: { type: 'json_object' },
	messages: [
		{
			role: 'system',
			content: `
			Du bist ein Traum-Visualisierer. Deine Aufgabe ist es, aus Traumbeschreibungen ein kurzes, poetisches Gedicht zu erstellen und eine detaillierte Bildbeschreibung für eine KI-Bildgenerierung zu formulieren.

			Antworte immer in folgendem JSON-Format:
			{
				"poem": "Ein kurzes Gedicht (4-8 Zeilen) über den Traum",
				"image_prompt": "Eine detaillierte, künstlerische Beschreibung für die Bildgenerierung (auf Englisch, sehr visuell und atmosphärisch)"
			}

			Das Gedicht soll poetisch und traumhaft sein. Die Bildbeschreibung soll sehr detailliert, visuell und atmosphärisch sein, damit eine Bild-KI ein schönes, künstlerisches Bild generieren kann.
			`,
		},
	],
};

// TODO: Ersetze dies mit deinem eigenen Val Town Endpoint
const apiEndpoint = 'https://nicolesophie--1e1820d7d4504ec0b233ac41bb8a5b87.web.val.run';
const imageApiEndpoint = 'https://api.openai.com/v1/images/generations'; // Dies müsste auch über Val Town laufen

const MAX_HISTORY_LENGTH = 10;

document.addEventListener('DOMContentLoaded', () => {
	const chatHistoryElement = document.querySelector('.chat-history');
	const inputElement = document.querySelector('input');
	const formElement = document.querySelector('form');
	const submitButton = document.querySelector('button');
	
	if (!chatHistoryElement || !formElement || !inputElement || !submitButton) {
		throw new Error('Erforderliche DOM-Elemente nicht gefunden');
	}

	formElement.addEventListener('submit', async (event) => {
		event.preventDefault();

		const formData = new FormData(formElement);
		const content = formData.get('content');
		if (!content || !content.toString().trim()) {
			return;
		}

		// UI während der Verarbeitung deaktivieren
		submitButton.disabled = true;
		submitButton.innerHTML = '<span class="loading"></span>';
		
		// Benutzernachricht hinzufügen
		messageHistory.messages.push({ role: 'user', content: content.toString() });
		messageHistory = truncateHistory(messageHistory);
		chatHistoryElement.innerHTML = addToChatHistoryElement(messageHistory);
		inputElement.value = '';
		scrollToBottom(chatHistoryElement);

		try {
			// Schritt 1: Gedicht und Bildprompt generieren
			const response = await fetch(apiEndpoint, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify(messageHistory),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${await response.text()}`);
			}

			const json = await response.json();
			console.log('LLM Response:', json);
			
			const assistantMessage = json.completion.choices[0].message;
			let dreamData;
			
			try {
				dreamData = JSON.parse(assistantMessage.content);
			} catch (e) {
				console.error('JSON Parse Error:', e);
				dreamData = {
					poem: assistantMessage.content,
					image_prompt: "A dreamy, surreal landscape with soft colors and ethereal atmosphere"
				};
			}

			// Schritt 2: Bild generieren (simuliert - du müsstest hier deine echte Bild-API verwenden)
			const imageUrl = await generateDreamImage(dreamData.image_prompt);
			
			// Ergebnis zusammenstellen
			const dreamResult = {
				poem: dreamData.poem,
				image_url: imageUrl,
				image_prompt: dreamData.image_prompt
			};

			// Assistant-Nachricht mit vollem Traumergebnis hinzufügen
			messageHistory.messages.push({
				role: 'assistant',
				content: JSON.stringify(dreamResult)
			});
			
			messageHistory = truncateHistory(messageHistory);
			chatHistoryElement.innerHTML = addToChatHistoryElement(messageHistory);
			scrollToBottom(chatHistoryElement);

		} catch (error) {
			console.error('Fehler:', error);
			// Fehlernachricht hinzufügen
			messageHistory.messages.push({
				role: 'assistant',
				content: JSON.stringify({
					poem: "Ein Fehler ist aufgetreten,\ndie Träume bleiben ungesehen.\nVersuche es erneut,\nund lass die Visionen entstehen.",
					image_url: null,
					error: error.message
				})
			});
			chatHistoryElement.innerHTML = addToChatHistoryElement(messageHistory);
			scrollToBottom(chatHistoryElement);
		} finally {
			// UI wieder aktivieren
			submitButton.disabled = false;
			submitButton.textContent = 'visualize';
		}
	});
});

async function generateDreamImage(prompt) {
	// ACHTUNG: Dies ist eine Simulation!
	// Du müsstest hier deine echte Bild-API verwenden (z.B. über Val Town)
	
	console.log('Generating image for prompt:', prompt);
	
	// Für Demo-Zwecke verwenden wir ein Placeholder-Bild
	// Ersetze dies mit deiner echten Bild-API:
	/*
	try {
		const response = await fetch(imageApiEndpoint, {
			method: 'POST',
			headers: {
				'Authorization': 'Bearer YOUR_OPENAI_API_KEY',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				prompt: prompt,
				n: 1,
				size: "512x512"
			})
		});
		
		const data = await response.json();
		return data.data[0].url;
	} catch (error) {
		console.error('Image generation error:', error);
		return null;
	}
	*/
	
	// Simulation mit Placeholder
	await new Promise(resolve => setTimeout(resolve, 2000)); // Simuliere Ladezeit
	return `https://picsum.photos/400/400?random=${Date.now()}`;
}

function addToChatHistoryElement(mhistory) {
	const htmlStrings = mhistory.messages.map((message) => {
		if (message.role === 'system') return '';
		
		if (message.role === 'user') {
			return `<div class="message user">${message.content}</div>`;
		}
		
		if (message.role === 'assistant') {
			try {
				const dreamData = JSON.parse(message.content);
				return `
					<div class="message assistant">
						<div class="dream-result">
							<div class="poem-section">
								<div class="poem-title">your dream poem:</div>
								<div class="poem-content">${dreamData.poem}</div>
							</div>
							${dreamData.image_url ? `
								<div class="image-section">
									<div style="font-weight: bold; margin-bottom: 8px;">your dream-image:</div>
									<img src="${dreamData.image_url}" alt="generated dream image" class="dream-image" />
								</div>
							` : ''}
							${dreamData.error ? `<div style="color: #e74c3c; font-size: 0.9em;">Fehler: ${dreamData.error}</div>` : ''}
						</div>
					</div>
				`;
			} catch (e) {
				return `<div class="message assistant">${message.content}</div>`;
			}
		}
		
		return '';
	});
	return htmlStrings.join('');
}

function scrollToBottom(container) {
	container.scrollTop = container.scrollHeight;
}

function truncateHistory(h) {
	if (!h || !h.messages || h.messages.length <= 1) {
		return h;
	}
	const { messages } = h;
	const [system, ...rest] = messages;
	if (rest.length > MAX_HISTORY_LENGTH) {
		return { ...h, messages: [system, ...rest.slice(-MAX_HISTORY_LENGTH)] };
	}
	return h;
}