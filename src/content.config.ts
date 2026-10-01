import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

// Starlight 0.42 的 UI 文案走 i18n 集合。本站文档仍用内置英文，
// 不在 src/content/i18n 放译文；注册空集合是为了让 Astro 7 不再把
// “集合不存在”当成 404 生成时的内容错误。
export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
