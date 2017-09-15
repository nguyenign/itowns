import { Vector3 } from 'three';
import Extent from '../../Geographic/Extent';
import OGCWebServiceHelper from './OGCWebServiceHelper';
import Fetcher from './Fetcher';

// select the smallest image entirely covering the tile
function selectBestImageForExtent(images, extent) {
    let selection;
    for (const entry of images) {
        if (extent.isInside(entry.extent)) {
            if (!selection) {
                selection = entry;
            } else {
                const d = selection.extent.dimensions();
                const e = entry.extent.dimensions();
                if (e.x <= d.x && e.y <= d.y) {
                    selection = entry;
                }
            }
        }
    }
    return selection;
}


/**
 * This provider uses no protocol but instead download static images directly.
 *
 * It uses as input 'image_filename: extent' values and then tries to find the best image
 * for a given tile using the extent property.
 */
export default {
    preprocessDataLayer(layer) {
        if (!layer.extent) {
            throw new Error('layer.extent is required');
        }

        if (!(layer.extent instanceof Extent)) {
            layer.extent = new Extent(layer.projection, ...layer.extent);
        }

        layer.options = {};
        layer.canTileTextureBeImproved = this.canTileTextureBeImproved;
        return Fetcher.json(layer.url).then((metadata) => {
            layer.images = [];
            // eslint-disable-next-line guard-for-in
            for (const image in metadata) {
                const extent = new Extent(layer.projection, ...metadata[image]);
                layer.images.push({
                    image,
                    extent,
                });
            }
        });
    },

    tileInsideLimit(tile, layer) {
        for (const entry of layer.images) {
            if (tile.extent.isInside(entry.extent)) {
                return true;
            }
        }

        return false;
    },

    canTileTextureBeImproved(layer, tile) {
        const s = selectBestImageForExtent(layer.images, tile.extent);
        if (!s) {
            return false;
        }
        const mat = tile.material;
        const idx = mat.getLayerTextureOffset(layer.id);
        const currentTexture = mat.textures[1][idx];
        if (!currentTexture.file) {
            return true;
        }
        return currentTexture.file != s.image;
    },

    getColorTexture(tile, layer) {
        if (!this.tileInsideLimit(tile, layer)) {
            return Promise.reject(`Tile '${tile}' is outside layer bbox ${layer.extent}`);
        }
        if (tile.material === null) {
            return Promise.resolve();
        }

        if (!layer.images) {
            return Promise.reject();
        }

        const selection = selectBestImageForExtent(layer.images, tile.extent);

        if (!selection) {
            return Promise.reject('pas dimage');
        }

        return OGCWebServiceHelper.getColorTextureByUrl(layer.url.replace('metadata.json', selection.image), layer.networkOptions).then((texture) => {
            // adjust pitch
            const result = {
                texture,
                pitch: new Vector3(0, 0, 1),
            };

            result.texture.extent = selection.extent;
            result.texture.coords = selection.extent;
            if (!result.texture.coords.zoom || result.texture.coords.zoom > tile.level) {
                result.texture.coords.zoom = tile.level;
                result.texture.file = selection.image;
            }
            // TODO: modify TileFS to handle tiles with ratio != image's ratio
            result.pitch = tile.extent.offsetToParent(selection.extent);


            return result;
        });
    },

    executeCommand(command) {
        const tile = command.requester;
        const layer = command.layer;
        return this.getColorTexture(tile, layer);
    },
};
