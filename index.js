//@ts-check
// [x]. get the content from the input element
// [x]. send the content to the val town endpoint using fetch POST request
// [x]. await the response
// [x]. get the json from the response
// [x]. Add the user message to the .chat-history

// How to control the behaviour of the chat bot?

// Bonus:
// What happens if the context gets to long?
// What happens if the chat-history window get s to full (scolling)

let messageHistory = {
    // messages: [{role: user | assistant; content: string}]
    // The system prompt is now managed entirely within the Valtown Vall.
    messages: [
        // Initial "opener" from the date partner (assistant)
        // This simulates the very first message from the date partner and provides initial options.
        {
            role: 'assistant',
            content: JSON.stringify({
                response: "Hallo! Schön, dass du da bist. Hattest du eine gute Anreise?",
                rating: 3,
                next_options: [
                    "Ja, super, danke!",
                    "Es ging so, der Verkehr war schlimm.",
                    "Eigentlich bin ich etwas gestresst."
                ]
            })
        }
    ],
};

// TODO: use your own val.town endpoint
// YOUR VALTOWN ENDPOINT MUST BE PUBLIC FOR THIS TO WORK
// If it's private, you'll need to send an Authorization header with your API key.
const apiEndpoint = 'https://nicolesophie--5a1dc17f24494298aa2e650b67aa388e.web.val.run';


const MAX_HISTORY_LENGTH = 10; // Maximale Anzahl von Benutzer- und Assistenten-Nachrichten im Verlauf

document.addEventListener('DOMContentLoaded', () => {
    // Holen der DOM-Elemente
    const chatHistoryElement = document.querySelector('.chat-history');
    const formElement = document.querySelector('form');
    const optionsContainer = document.querySelector('.options-container'); // Container für Auswahlmöglichkeiten

    // Prüfen, ob die Elemente existieren
    if (!chatHistoryElement) throw new Error('Could not find element .chat-history');
    if (!formElement) throw new Error('Form element does not exists');
    if (!optionsContainer) throw new Error('Could not find element .options-container');

    // Initiales Rendern des Chat-Verlaufs und der Optionen beim Laden der Seite
    updateUI(chatHistoryElement, optionsContainer);

    // Event-Listener für das Absenden des Formulars
    formElement.addEventListener('submit', async (event) => {
        event.preventDefault(); // Verhindert das Neuladen der Seite

        const formData = new FormData(formElement);
        // 'options' ist der Name der Radio-Buttons im Formular
        const content = formData.get('options'); 
        if (!content) {
            // Zeige eine Fehlermeldung an, wenn keine Option ausgewählt wurde
            const errorMessageDiv = document.createElement('div');
            errorMessageDiv.classList.add('message', 'error');
            errorMessageDiv.textContent = `Bitte wähle eine Option aus, bevor du antwortest.`;
            chatHistoryElement.appendChild(errorMessageDiv);
            scrollToBottom(chatHistoryElement);
            return; // Beende die Funktion hier
        }

        // Benutzer-Nachricht zum Verlauf hinzufügen
        messageHistory.messages.push({ role: 'user', content: content.toString() });
        messageHistory = truncateHistory(messageHistory); // Verlauf kürzen

        // UI aktualisieren (Benutzer-Nachricht anzeigen, Ladeindikator zeigen)
        updateUI(chatHistoryElement, optionsContainer, true); // `true` zeigt den Ladezustand

        // API-Anfrage an Valtown senden
        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify(messageHistory),
            });

            // Wenn die HTTP-Antwort nicht OK ist (z.B. 4xx oder 5xx Fehler)
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API-Fehler (${response.status}): ${errorText}`);
            }

            // Die JSON-Antwort von Valtown erhalten
            const jsonResponse = await response.json();
            console.log("Valtown Response JSON:", jsonResponse);

            // Den Inhalt der LLM-Antwort parsen (ist ein JSON-String innerhalb des 'content'-Feldes)
            const llmContentString = jsonResponse.completion.choices[0].message.content;
            const llmParsedContent = JSON.parse(llmContentString);

            // LLM-Antwort zum Verlauf hinzufügen (als JSON-String für Konsistenz speichern)
            messageHistory.messages.push({ role: 'assistant', content: llmContentString });
            messageHistory = truncateHistory(messageHistory); // Verlauf erneut kürzen

            // UI aktualisieren (LLM-Antwort und neue Optionen anzeigen)
            updateUI(chatHistoryElement, optionsContainer);

        } catch (error) {
            console.error("Fehler beim Senden oder Verarbeiten der API-Antwort:", error);
            // Zeige eine allgemeine Fehlermeldung im Chat an
            const errorMessageDiv = document.createElement('div');
            errorMessageDiv.classList.add('message', 'error');
            errorMessageDiv.textContent = `Ein schwerwiegender Fehler ist aufgetreten: ${error.message}. Bitte lade die Seite neu.`;
            chatHistoryElement.appendChild(errorMessageDiv);
            scrollToBottom(chatHistoryElement);
            // Optionen deaktivieren oder Fehlermeldung anzeigen
            optionsContainer.innerHTML = '<div class="message error">Das Date konnte nicht fortgesetzt werden.</div>';
        }
    });
});

/**
 * Aktualisiert die UI-Elemente (Chat-Verlauf und Optionen).
 * @param {HTMLElement} chatHistoryElement Das Element, das den Chat-Verlauf anzeigt.
 * @param {HTMLElement} optionsContainer Das Element, das die Auswahlmöglichkeiten anzeigt.
 * @param {boolean} [showLoading=false] Gibt an, ob ein Ladeindikator anstelle von Optionen angezeigt werden soll.
 */
function updateUI(chatHistoryElement, optionsContainer, showLoading = false) {
    chatHistoryElement.innerHTML = ''; // Vorhandenen Chat-Inhalt leeren

    // Iteriere durch die Nachrichten und füge sie dem Chat-Verlauf hinzu
    messageHistory.messages.forEach(message => {
        // System-Nachrichten nicht anzeigen, da sie nur für das LLM sind
        if (message.role === 'system') return;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', message.role);

        // Wenn es eine Assistenten-Nachricht ist, parsen wir den JSON-Inhalt
        if (message.role === 'assistant') {
            try {
                const parsedContent = JSON.parse(message.content);
                messageDiv.textContent = parsedContent.response; // Zeige nur den 'response'-Teil an
                // Optional: rating könnte hier auch angezeigt werden
                // messageDiv.innerHTML += `<br><small>Rating: ${parsedContent.rating}/5</small>`;
            } catch (e) {
                // Fehler beim Parsen der Assistenten-Nachricht
                messageDiv.textContent = `[Ungültige Nachricht vom Date] ${message.content}`;
                console.error("Fehler beim Parsen der Assistenten-Nachricht JSON:", e, message.content);
            }
        } else {
            // Benutzer-Nachricht anzeigen
            messageDiv.textContent = message.content;
        }
        chatHistoryElement.appendChild(messageDiv);
    });

    scrollToBottom(chatHistoryElement); // Zum Ende des Chats scrollen

    // Optionen aktualisieren
    optionsContainer.innerHTML = ''; // Alte Optionen leeren

    if (showLoading) {
        // Ladeindikator anzeigen
        optionsContainer.innerHTML = '<div class="loading">Antwort wird generiert...</div>';
    } else {
        // Die letzte Assistenten-Nachricht finden, um die nächsten Optionen zu extrahieren
        const lastAssistantMessage = messageHistory.messages
            .filter(msg => msg.role === 'assistant')
            .pop();

        if (lastAssistantMessage) {
            try {
                const parsedContent = JSON.parse(lastAssistantMessage.content);
                // Wenn 'next_options' vorhanden sind und nicht leer sind
                if (parsedContent.next_options && parsedContent.next_options.length > 0) {
                    parsedContent.next_options.forEach(optionText => {
                        // Erstelle Radio-Button und Label für jede Option
                        const optionDiv = document.createElement('div'); // Wrapper für Styling
                        const optionInput = document.createElement('input');
                        optionInput.type = 'radio';
                        optionInput.name = 'options'; // Wichtig: Gleicher Name für alle Radio-Buttons
                        optionInput.value = optionText;
                        optionInput.id = `option-${optionText.replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`; // Eindeutige ID

                        const optionLabel = document.createElement('label');
                        optionLabel.htmlFor = optionInput.id;
                        optionLabel.textContent = optionText;

                        optionDiv.appendChild(optionInput);
                        optionDiv.appendChild(optionLabel);
                        optionsContainer.appendChild(optionDiv);
                    });
                    // Füge den "Antworten"-Button hinzu
                    const submitButton = document.createElement('button');
                    submitButton.type = 'submit';
                    submitButton.textContent = 'Antworten';
                    optionsContainer.appendChild(submitButton);

                } else {
                    // Keine weiteren Optionen vom LLM zurückgegeben (Date beendet?)
                    optionsContainer.innerHTML = '<div class="no-options">Keine weiteren Optionen. Das Date ist beendet.</div>';
                }
            } catch (e) {
                // Fehler beim Parsen der Optionen aus der Assistenten-Nachricht
                optionsContainer.innerHTML = '<div class="error">Fehler beim Laden der Optionen.</div>';
                console.error("Fehler beim Parsen der Optionen aus Assistenten-Nachricht:", e, lastAssistantMessage.content);
            }
        } else {
            // Dies sollte nur beim ersten Laden der Seite passieren, wenn noch keine Assistenten-Nachricht da ist
            // Das HTML hat bereits eine Fallback-Nachricht: "<div class="no-options">Lass uns das Date beginnen!</div>"
            // Die initiale Assistenten-Nachricht in messageHistory sollte dies aber normalerweise verhindern.
            optionsContainer.innerHTML = '<div class="no-options">Wähle eine Option, um das Date zu starten!</div>';
        }
    }
}

/**
 * Scrollt das angegebene HTML-Element ganz nach unten.
 * @param {HTMLElement} container Das Element, das gescrollt werden soll.
 */
function scrollToBottom(container) {
    container.scrollTop = container.scrollHeight;
}

/**
 * Kürzt den Nachrichtenverlauf, um ihn innerhalb von MAX_HISTORY_LENGTH zu halten,
 * wobei die erste System-Nachricht (falls vorhanden) erhalten bleibt.
 * @param {{messages: {role: string, content: string}[]}} h - Das Nachrichtenverlauf-Objekt.
 * @returns {{messages: {role: string, content: string}[]}} Der gekürzte Verlauf.
 */
function truncateHistory(h) {
    if (!h || !h.messages || h.messages.length <= 1) {
        return h; // Keine Kürzung nötig oder möglich
    }

    const { messages } = h;
    let systemMessage = null;
    let conversationalMessages = [];

    // System-Nachricht von den Konversationsnachrichten trennen
    if (messages[0].role === 'system') {
        systemMessage = messages[0];
        conversationalMessages = messages.slice(1);
    } else {
        conversationalMessages = messages;
    }

    // Nur die letzten MAX_HISTORY_LENGTH Konversationsnachrichten behalten
    if (conversationalMessages.length > MAX_HISTORY_LENGTH) {
        conversationalMessages = conversationalMessages.slice(-MAX_HISTORY_LENGTH);
    }

    // Verlauf neu zusammensetzen
    if (systemMessage) {
        return { messages: [systemMessage, ...conversationalMessages] };
    } else {
        return { messages: conversationalMessages };
    }
}