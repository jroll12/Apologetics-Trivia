// Fixed position → shape → color mapping for Quick Draw answer tiles.
// Never changes round to round, and is shared verbatim between the Host
// Display and Player Controller so players build muscle memory across a
// whole game night. Source of truth: design_handoff_party_game_ui/README.md.
export type TileShape = 'triangle' | 'diamond' | 'circle' | 'square';

export interface TileStyle {
  shape: TileShape;
  fill: string;
  bright: string;
}

export const TILE_STYLES: readonly TileStyle[] = [
  { shape: 'triangle', fill: '#3E3993', bright: '#4F46E5' }, // position 1, top-left
  { shape: 'diamond', fill: '#5982A1', bright: '#80CAFF' }, // position 2, top-right
  { shape: 'circle', fill: '#9F5978', bright: '#FF80B5' }, // position 3, bottom-left
  { shape: 'square', fill: '#625E9F', bright: '#9089FC' }, // position 4, bottom-right
];
