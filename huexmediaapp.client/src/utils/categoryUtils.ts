import { normalizePathForComparison } from './generalUtils';

// --------------------------- Tipos de categorías ----------------------------

export type MediaItem = import('../components/SeriesCategoryRow').CategoryRowItem;

export interface MediaCategory {
    /** Identificador de la categoría o subcategoría. */
    id: string;
    /** Nombre visible del grupo. */
    name: string;
    /** Rutas de los elementos asignados directamente al grupo. */
    itemPaths: string[];
    /** Grupos hijos del mismo tipo. */
    subcategories: MediaCategory[];
}

export interface MediaLibrary {
    /** Versión del formato de biblioteca. */
    version: number;
    /** Identificador estable de la biblioteca. */
    id: string;
    /** Nombre visible en el selector. */
    name: string;
    /** Tipo de contenido de la biblioteca. */
    mediaType: 'Series'|'Movies';
    /** Carpeta raíz de las series o películas. */
    libraryPath: string;
    /** Categorías principales con sus descendientes. */
    categories: MediaCategory[];
}

export interface CategoryDestination {
    /** Identificador del grupo de destino. */
    id: string;
    /** Nombre completo del destino con sus grupos superiores. */
    name: string;
}

// ------------------------- Elementos de categorías --------------------------

/**
 * Reúne las rutas directas y las de todos los descendientes sin modificar los arrays.
 * @param paths Rutas asignadas directamente al grupo actual.
 * @param groups Grupos hijos que se recorrerán recursivamente.
 * @returns Array nuevo con las rutas directas y las de todos los descendientes.
 */
export function collectItemPaths(paths: string[], groups: MediaCategory[]): string[] {
    // flatMap une los arrays de rutas devueltos por cada rama hija.
    const childPaths = groups.flatMap(group => {
        return collectItemPaths(
            group.itemPaths ?? [],
            group.subcategories ?? []
        );
    });

    // concat devuelve un array nuevo con las rutas directas y las de los hijos.
    return paths.concat(childPaths);
}

/**
 * Obtiene los elementos disponibles cuyas rutas están asignadas a la categoría.
 * @param items Elementos disponibles en el escaneo de la biblioteca.
 * @param paths Rutas asignadas al grupo que se quiere mostrar.
 * @returns Elementos coincidentes, conservando los objetos completos y su tipo original.
 */
export function getCategoryItems<T extends MediaItem>(items: T[], paths: string[]): T[] {
    // Normaliza las rutas para comparar sin diferencias de barras o mayúsculas.
    const normalizedPaths = new Set(paths.map(normalizePathForComparison));

    // Conserva los objetos completos que utilizará el carrusel para las tarjetas.
    return items.filter(item => {
        return normalizedPaths.has(normalizePathForComparison(item.rutaCompleta));
    });
}

/**
 * Cuenta los elementos disponibles de una categoría y de todos sus descendientes.
 * @param items Series o películas disponibles en el escaneo.
 * @param group Grupo cuyas asignaciones y descendientes se cuentan.
 * @returns Cantidad de elementos disponibles asignados a la rama.
 */
export function countCategoryItems(items: MediaItem[], group: MediaCategory): number {
    const paths = collectItemPaths(
        group.itemPaths ?? [],
        group.subcategories ?? []
    );

    return getCategoryItems(items, paths).length;
}

/**
 * Construye una lista de destinos con sus nombres completos dentro de la jerarquía.
 * @param groups Grupos del nivel que se recorre.
 * @param [parentName=''] Nombre completo de los grupos superiores.
 * @returns Lista de destinos con identificador y nombre jerárquico.
 */
export function getCategoryDestinations(groups: MediaCategory[], parentName: string = ''): CategoryDestination[] {
    // flatMap reúne los destinos de todas las ramas en un único array.
    return groups.flatMap(group => {
        const name = parentName
            ? `${parentName} › ${group.name}`
            : group.name;

        const destination = {
            id: group.id,
            name
        };

        const children = getCategoryDestinations(
            group.subcategories ?? [],
            name
        );

        // Incluye primero el propio grupo y después sus descendientes.
        return [destination].concat(children);
    });
}
