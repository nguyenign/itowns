function overLine(point, vs, precision) {
    const x0 = point._values[0];
    const y0 = point._values[1];
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const x1 = vs[i]._values[0];
        const y1 = vs[i]._values[1];
        const x2 = vs[j]._values[0];
        const y2 = vs[j]._values[1];

        const Xp = x0 - x1;
        const Yp = y0 - y1;

        const x21 = x2 - x1;
        const y21 = y2 - y1;
        const n = Math.sqrt(x21 * x21 + y21 * y21);
        const scalar = (Xp * x21 + Yp * y21) / n;

        if (scalar >= -precision && scalar <= n + precision) {
            const distance = Math.abs(y21 * x0 - x21 * y0 + x2 * y1 - y2 * x1) / n;
            if (distance <= precision) {
                return true;
            }
        }
    }

    return false;
}

function indiceOverPoints(point, vs, precision) {
    const x0 = point._values[0];
    const y0 = point._values[1];
    for (var i = 0; i < vs.length; ++i) {
        const x1 = vs[i]._values[0];
        const y1 = vs[i]._values[1];
        const xP = x0 - x1;
        const yP = y0 - y1;
        const n = Math.sqrt(xP * xP + yP * yP);
        if (n < precision) {
            return i;
        }
    }
}

function insidePolygon(point, vs) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

    const x = point._values[0];
    const y = point._values[1];

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i]._values[0];
        const yi = vs[i]._values[1];
        const xj = vs[j]._values[0];
        const yj = vs[j]._values[1];

        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

export default {
    getFeaturesAtCoordinate(coordinate, collection, precision = 0.1) {
        const result = { points: [], lines: [], polygons: [] };
        if (collection.geometries) {
            if (collection.extent && !collection.extent.isPointInside(coordinate, precision)) {
                return result;
            }
            for (const features of collection.geometries) {
                if (features.extent && !features.extent.isPointInside(coordinate, precision)) {
                    continue;
                }
                /* eslint-disable guard-for-in */
                for (const id in features.featureVertices) {
                    const polygon = features.featureVertices[id];
                    if (polygon.extent && !polygon.extent.isPointInside(coordinate, precision)) {
                        continue;
                    }
                    const properties = collection.features[id].properties.properties;
                    const coordinates = features.coordinates.slice(polygon.offset, polygon.offset + polygon.count);
                    if (features.type == 'linestring' && overLine(coordinate, coordinates, precision)) {
                        result.lines.push({ properties, coordinates });
                    } else if (features.type == 'polygon' && insidePolygon(coordinate, coordinates)) {
                        result.polygons.push({ properties, coordinates });
                    } else if (features.type == 'point') {
                        const indice = indiceOverPoints(coordinate, coordinates, precision);
                        if (indice != undefined) {
                            result.points.push({ properties, coordinates: coordinates[indice] });
                        }
                    }
                }
            }
        } else if (collection.geometry) {
            if (collection.geometry.extent && !collection.geometry.extent.isPointInside(coordinate, precision)) {
                return result;
            }
            if (collection.geometry.type == 'polygon' && insidePolygon(coordinate, collection.geometry.coordinates)) {
                result.polygons.push({ properties: collection.properties.properties, coordinates: collection.geometry.coordinates });
            } else if (collection.geometry.type == 'linestring' && overLine(coordinate, collection.geometry.coordinates, precision)) {
                result.lines.push({ properties: collection.properties.properties, coordinates: collection.geometry.coordinates });
            } else if (collection.geometry.type == 'point') {
                const indice = indiceOverPoints(coordinate, collection.geometry.coordinates, precision);
                if (indice != undefined) {
                    result.points.push({ properties: collection.properties.properties, coordinates: collection.geometry.coordinates[indice] });
                }
            }
        }
        return result;
    },
};
