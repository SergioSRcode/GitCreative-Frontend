import type { BlendMode } from "./layer";

// JSON envelope stored at the start of every .gitcreative file
export type DocumentMetadata = {
  version: number,  // format version
  name: string,  // project name
  width: number,  // canvas width in CSS px
  height: number,  // canvas height in CSS px
  activeLayerId: string | null,
  layers: DocumentLayerMeta[],
};

// each layers metadata stored in the JSON envelope
export type DocumentLayerMeta = {
  id: string,
  name: string,
  visible: boolean,
  opacity: number,
  blendMode: BlendMode,
  index: number,  // render order => start from 0 (bottom layer)
};