declare module 'shapefile' {
  export function read(shp: ArrayBuffer | Uint8Array | string, dbf?: ArrayBuffer | Uint8Array | string): Promise<unknown>;
}
