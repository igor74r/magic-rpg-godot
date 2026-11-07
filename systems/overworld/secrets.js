// Every combat region should offer exploration value without flooding the map.
export function getSecretWallCount(random = Math.random) {
  return random() < 0.20 ? 2 : 1;
}
