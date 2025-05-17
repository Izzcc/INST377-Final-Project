window.addEventListener('DOMContentLoaded', () => {
fetch('/api/time')
  .then(response => response.json())
  .then(data => {
    const timeElem = document.getElementById('time');
    const aboutWelcome = document.getElementById('aboutWelcome');
    
    if (timeElem) {
      timeElem.textContent = `The time is: ${data.serverTime}`;
    }
    
    if (aboutWelcome) {
      aboutWelcome.innerHTML = `Welcome to PropHunt - ${data.serverTime}`;
    }
  })
  .catch(err => console.error('Error fetching time:', err));
});
