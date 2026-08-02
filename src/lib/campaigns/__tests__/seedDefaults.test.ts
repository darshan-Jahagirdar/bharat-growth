import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_CAMPAIGNS } from '../defaults';
import { seedDefaultCampaigns } from '../seedDefaults';
import type { BusinessType } from '@/lib/types/database';

interface TagRow {
  id: string;
  shop_id: string;
  name: string;
}

interface RuleRow {
  shop_id: string;
  tag_id: string;
  name: string;
  trigger_days: number;
  template_key: string;
  custom_variable: string;
  is_active: boolean;
  message_template: string | null;
}

interface QueryState {
  operation: 'select' | 'insert';
  insertedRows: Array<Record<string, unknown>>;
  filters: Array<
    | { method: 'eq'; column: string; value: unknown }
    | { method: 'in'; column: string; values: unknown[] }
  >;
  returnRows: boolean;
}

function createStatefulCampaignClient(initial?: {
  tags?: TagRow[];
  rules?: RuleRow[];
}) {
  const tags = structuredClone(initial?.tags ?? []);
  const rules = structuredClone(initial?.rules ?? []);
  const tagWrites: TagRow[][] = [];
  const ruleWrites: RuleRow[][] = [];
  let nextTagId = tags.length + 1;

  const from = vi.fn((table: 'tags' | 'campaign_rules') => {
    const state: QueryState = {
      operation: 'select',
      insertedRows: [],
      filters: [],
      returnRows: false,
    };

    const builder = {
      select: vi.fn(() => {
        state.returnRows = true;
        return builder;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        state.filters.push({ method: 'eq', column, value });
        return builder;
      }),
      in: vi.fn((column: string, values: unknown[]) => {
        state.filters.push({ method: 'in', column, values });
        return builder;
      }),
      insert: vi.fn((rows: Array<Record<string, unknown>>) => {
        state.operation = 'insert';
        state.insertedRows = structuredClone(rows);
        return builder;
      }),
      then: (
        onfulfilled?: (value: { data: unknown; error: null }) => unknown,
        onrejected?: (reason: unknown) => unknown
      ) => {
        const execute = () => {
          if (state.operation === 'insert') {
            if (table === 'tags') {
              const inserted = state.insertedRows.map((row) => ({
                id: `tag-${nextTagId++}`,
                shop_id: row.shop_id as string,
                name: row.name as string,
              }));
              tags.push(...inserted);
              tagWrites.push(structuredClone(inserted));
              return { data: state.returnRows ? inserted : null, error: null };
            }

            const inserted = state.insertedRows as unknown as RuleRow[];
            rules.push(...structuredClone(inserted));
            ruleWrites.push(structuredClone(inserted));
            return { data: state.returnRows ? inserted : null, error: null };
          }

          const source = table === 'tags' ? tags : rules;
          const data = source.filter((row) =>
            state.filters.every((filter) => {
              const value = row[filter.column as keyof typeof row];
              return filter.method === 'eq'
                ? value === filter.value
                : filter.values.includes(value);
            })
          );
          return { data: structuredClone(data), error: null };
        };

        return Promise.resolve(execute()).then(onfulfilled, onrejected);
      },
    };

    return builder;
  });

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    tags,
    rules,
    tagWrites,
    ruleWrites,
  };
}

describe('seedDefaultCampaigns', () => {
  it.each([
    'tyre_shop',
    'grocery',
    'garment_store',
    'sweet_stall',
    'general',
  ] satisfies BusinessType[])('seeds the complete inactive %s default set', async (businessType) => {
    const store = createStatefulCampaignClient();
    const defaults = DEFAULT_CAMPAIGNS[businessType];
    const expectedTagNames = [...new Set(defaults.map((item) => item.tagName))];

    await expect(
      seedDefaultCampaigns(store.client, 'shop-1', businessType)
    ).resolves.toEqual({
      tagsCreated: expectedTagNames.length,
      rulesCreated: defaults.length,
    });

    expect(store.tags.map((tag) => tag.name)).toEqual(expectedTagNames);
    expect(store.rules).toEqual(
      defaults.map((item) =>
        expect.objectContaining({
          shop_id: 'shop-1',
          tag_id: store.tags.find((tag) => tag.name === item.tagName)?.id,
          name: item.ruleName,
          trigger_days: item.triggerDays,
          template_key: item.templateKey,
          custom_variable: item.customVariable,
          is_active: false,
          message_template: null,
        })
      )
    );
  });

  it('seeds the full default set, then makes an exact sequential second run a no-op', async () => {
    const store = createStatefulCampaignClient();
    const defaults = DEFAULT_CAMPAIGNS.tyre_shop;
    const expectedTagNames = [...new Set(defaults.map((item) => item.tagName))];

    await expect(
      seedDefaultCampaigns(store.client, 'shop-1', 'tyre_shop')
    ).resolves.toEqual({
      tagsCreated: expectedTagNames.length,
      rulesCreated: defaults.length,
    });
    expect(store.tags.map((tag) => tag.name)).toEqual(expectedTagNames);
    expect(store.rules).toHaveLength(defaults.length);
    expect(store.rules).toEqual(
      defaults.map((item) =>
        expect.objectContaining({
          shop_id: 'shop-1',
          tag_id: store.tags.find((tag) => tag.name === item.tagName)?.id,
          name: item.ruleName,
          trigger_days: item.triggerDays,
          template_key: item.templateKey,
          custom_variable: item.customVariable,
          is_active: false,
          message_template: null,
        })
      )
    );

    const writesAfterFirstRun = {
      tags: store.tagWrites.length,
      rules: store.ruleWrites.length,
    };
    await expect(
      seedDefaultCampaigns(store.client, 'shop-1', 'tyre_shop')
    ).resolves.toEqual({ tagsCreated: 0, rulesCreated: 0 });

    expect(store.tagWrites).toHaveLength(writesAfterFirstRun.tags);
    expect(store.ruleWrites).toHaveLength(writesAfterFirstRun.rules);
    expect(store.tags).toHaveLength(expectedTagNames.length);
    expect(store.rules).toHaveLength(defaults.length);
  });

  it('matches by resolved tag, trigger days, and template key without changing a customized rule', async () => {
    const [matchingDefault, ...remainingDefaults] = DEFAULT_CAMPAIGNS.general;
    const existingTag: TagRow = {
      id: 'tag-existing',
      shop_id: 'shop-1',
      name: matchingDefault.tagName,
    };
    const customizedRule: RuleRow = {
      shop_id: 'shop-1',
      tag_id: existingTag.id,
      name: 'My own campaign name',
      trigger_days: matchingDefault.triggerDays,
      template_key: matchingDefault.templateKey,
      custom_variable: 'my hand-edited offer',
      is_active: true,
      message_template: 'A custom template that must stay untouched',
    };
    const store = createStatefulCampaignClient({
      tags: [existingTag],
      rules: [customizedRule],
    });

    await expect(
      seedDefaultCampaigns(store.client, 'shop-1', 'general')
    ).resolves.toEqual({
      tagsCreated: new Set(remainingDefaults.map((item) => item.tagName)).size,
      rulesCreated: remainingDefaults.length,
    });

    expect(store.rules[0]).toEqual(customizedRule);
    expect(store.rules).toHaveLength(DEFAULT_CAMPAIGNS.general.length);
    expect(store.ruleWrites.flat()).not.toContainEqual(
      expect.objectContaining({
        tag_id: existingTag.id,
        trigger_days: matchingDefault.triggerDays,
        template_key: matchingDefault.templateKey,
      })
    );
  });
});
