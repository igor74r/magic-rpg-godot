import { state } from '../state.js';

export function pushLog(msg, cls = '') {
  const ow = state.overworld;
  if (!ow) return;
  ow.log.push({ msg, cls });
  if (ow.log.length > 5) ow.log.shift();
}