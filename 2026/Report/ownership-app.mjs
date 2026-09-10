import { rankOwnership, ownershipView } from './ownership-model.mjs';
import { ownershipBars, ownershipPlayers } from './ownership-template.mjs';

export function startOwnership(data) {
  const section = document.querySelector('#rank-shares');
  if (!section) return;
  const cohorts = rankOwnership(data.players, data.teams);
  let team = null, top = 30;
  function render(changeCutoff) {
    const view = ownershipView(cohorts, team, top);
    // Cutoff controls stay in place; selecting a team also preserves its button.
    if (changeCutoff) section.querySelector('#ownership-bars').innerHTML = ownershipBars(view);
    for (const button of section.querySelectorAll('[data-share-team]')) button.setAttribute('aria-pressed', String(button.dataset.shareTeam === team));
    for (const button of section.querySelectorAll('[data-share-cutoff]')) button.setAttribute('aria-pressed', String(Number(button.dataset.shareCutoff) === top));
    section.querySelector('#ownership-players').innerHTML = ownershipPlayers(view);
    section.querySelector('#ownership-clear').hidden = team === null;
    section.querySelector('#ownership-status').textContent = team === null
      ? `Comparing all teams’ shares of the top ${top}. No team selected.`
      : `${team}: ${view.players.length} of the top ${top}. Player list updated.`;
  }
  section.addEventListener('click', event => {
    const teamButton = event.target.closest('[data-share-team]'), cutoffButton = event.target.closest('[data-share-cutoff]');
    if (teamButton) team = teamButton.dataset.shareTeam;
    else if (cutoffButton) top = Number(cutoffButton.dataset.shareCutoff);
    else if (event.target.closest('#ownership-clear')) {
      team = null;
      section.querySelector(`[data-share-cutoff="${top}"]`).focus();
    } else return;
    render(Boolean(cutoffButton));
  });
  for (const button of section.querySelectorAll('button')) button.disabled = false;
  document.documentElement.dataset.ownershipReady = 'true';
}
