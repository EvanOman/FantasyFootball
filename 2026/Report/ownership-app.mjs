import { rankOwnership, ownershipView } from './ownership-model.mjs';
import { ownershipBars, ownershipPlayers } from './ownership-template.mjs';

export function startOwnership(data) {
  const section = document.querySelector('#rank-shares');
  if (!section) return;
  const cohorts = rankOwnership(data.players, data.teams);
  let team = 'Magic Skol Bus', top = 30;
  function render() {
    const view = ownershipView(cohorts, team, top);
    // Preserve the cutoff buttons (and keyboard focus) during updates.
    const template = document.createElement('template');
    template.innerHTML = ownershipBars(view);
    for (const row of section.querySelectorAll('[data-cohort]')) {
      const next = template.content.querySelector(`[data-cohort="${row.dataset.cohort}"]`);
      row.querySelector('.ownership-stat').innerHTML = next.querySelector('.ownership-stat').innerHTML;
      row.querySelector('.ownership-bar').replaceWith(next.querySelector('.ownership-bar'));
      const button = row.querySelector('[data-share-cutoff]'), source = next.querySelector('[data-share-cutoff]');
      for (const name of ['aria-label','aria-pressed']) button.setAttribute(name, source.getAttribute(name));
    }
    for (const button of section.querySelectorAll('[data-share-team]')) button.setAttribute('aria-pressed', String(button.dataset.shareTeam === team));
    section.querySelector('#ownership-players').innerHTML = ownershipPlayers(view);
    section.querySelector('#ownership-status').textContent = `${team}: ${view.cohorts.map(c => `${c.selected.count} of the top ${c.top}`).join(', ')}.`;
  }
  section.addEventListener('click', event => {
    const teamButton = event.target.closest('[data-share-team]'), cutoffButton = event.target.closest('[data-share-cutoff]');
    if (teamButton) team = teamButton.dataset.shareTeam;
    else if (cutoffButton) top = Number(cutoffButton.dataset.shareCutoff);
    else return;
    render();
  });
  for (const button of section.querySelectorAll('button')) button.disabled = false;
  document.documentElement.dataset.ownershipReady = 'true';
}
