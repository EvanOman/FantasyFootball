// Report navigation. Draft Lab interactions are added after the design checkpoint.
document.querySelector('[data-lab-link]').addEventListener('click', event => {
  event.preventDefault();
  document.querySelector('#lab').hidden = false;
  document.querySelector('#lab').scrollIntoView({ behavior: 'smooth' });
});
