import { useEffect, useState } from 'react';
import type { Product } from '@/lib/types/database';
import type { SelectedCustomer } from './useBillingStore';
import { searchCustomers, searchProducts } from './billingQueries';
import { MOCK_CUSTOMERS, MOCK_PRODUCTS } from './mockData';

interface UseBillingSearchOptions {
  shopId: string;
  supabaseConfigured: boolean;
  demoMode: boolean;
}

export function useBillingSearch({
  shopId,
  supabaseConfigured,
  demoMode,
}: UseBillingSearchOptions) {
  const [customerQuery, setCustomerQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<SelectedCustomer[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!customerQuery || customerQuery.length < 2) {
      setFilteredCustomers([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (supabaseConfigured && shopId) {
        const results = await searchCustomers(customerQuery, shopId);
        if (!cancelled) setFilteredCustomers(results);
      } else if (demoMode) {
        const query = customerQuery.toLowerCase();
        if (!cancelled) {
          setFilteredCustomers(
            MOCK_CUSTOMERS.filter(
              (customer) =>
                customer.phoneNumber.includes(query) ||
                (customer.name && customer.name.toLowerCase().includes(query))
            )
          );
        }
      } else if (!cancelled) {
        setFilteredCustomers([]);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerQuery, demoMode, shopId, supabaseConfigured]);

  useEffect(() => {
    if (!productQuery || productQuery.length < 1) {
      setFilteredProducts([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (supabaseConfigured && shopId) {
        const results = await searchProducts(productQuery, shopId);
        if (!cancelled) setFilteredProducts(results);
      } else if (demoMode) {
        const query = productQuery.toLowerCase();
        if (!cancelled) {
          setFilteredProducts(
            MOCK_PRODUCTS.filter(
              (product) =>
                product.name.toLowerCase().includes(query) ||
                (product.sku && product.sku.toLowerCase().includes(query)) ||
                product.hsn_code.includes(query)
            )
          );
        }
      } else if (!cancelled) {
        setFilteredProducts([]);
      }
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [demoMode, productQuery, shopId, supabaseConfigured]);

  return {
    customerQuery,
    setCustomerQuery,
    productQuery,
    setProductQuery,
    showCustomerDropdown,
    setShowCustomerDropdown,
    showProductDropdown,
    setShowProductDropdown,
    filteredCustomers,
    filteredProducts,
  };
}
