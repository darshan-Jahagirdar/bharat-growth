'use client';

import { useState } from 'react';
import type { StorefrontProduct } from '@/lib/storefront/queries';
import {
  filterStorefrontProducts,
  getStorefrontCategories,
} from './modernStorefrontTransforms';

export function useModernStorefrontCatalog(products: StorefrontProduct[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const categories = getStorefrontCategories(products);
  const filteredProducts = filterStorefrontProducts(
    products,
    activeCategory,
    searchQuery
  );

  return {
    activeCategory,
    categories,
    filteredProducts,
    searchQuery,
    setActiveCategory,
    setSearchQuery,
  };
}

export type ModernStorefrontCatalogController = ReturnType<
  typeof useModernStorefrontCatalog
>;
