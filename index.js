const response = await fetch('https://www.val.town/v/YOUR_USER_NAME/openai_api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'Hello world'
      }
    ]
  })
});

const data = await response.json();