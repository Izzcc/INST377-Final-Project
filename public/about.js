window.addEventListener('DOMContentLoaded', () => {
  fetch('/api/time')
    .then(response => response.json())
    .then(data => {
      const rawTime = new Date(data.serverTime); 
      const readableTime = rawTime.toLocaleString();
      
      const timeElem = document.getElementById('time');
      const aboutWelcome = document.getElementById('aboutWelcome');

      if (timeElem) {
        timeElem.textContent = `The time is: ${readableTime}`;
      }

      if (aboutWelcome) {
        aboutWelcome.innerHTML = `Welcome to PropHunt - ${readableTime}`;
      }
    })
    .catch(err => console.error('Error fetching time:', err));
});
