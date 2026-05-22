import { getUIRefs, setStartEnabled, setStatus } from './ui/controls';

// M0 entry point: just wires the Start button to a placeholder handler.
// The camera + canvas pipeline lands in the next PR (m0/camera-capture).

function main(): void {
  const refs = getUIRefs();

  refs.startButton.addEventListener('click', () => {
    setStartEnabled(refs, false);
    setStatus(refs, 'Camera capture lands in the next PR.');
  });
}

main();
