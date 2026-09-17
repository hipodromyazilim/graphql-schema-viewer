# GraphQL Schema Explorer
_by Hipodrom Yazılım_

A small static viewer for GraphQL introspection JSON files. Open `index.html`, drop a schema JSON file onto the loader, and explore root operations, object types, input types, enums, and generated query selections.

## Features

- Drag-and-drop loading for `schema.json` or any compatible GraphQL introspection JSON file.
- English and Turkish interface, with English as the default language.
- Sidebar tree for Query, Mutation, and Subscription roots.
- Global search for types and fields with `Ctrl+K`.
- Click-to-build query preview with copy and download actions.
- Works as plain static files; no build step is required.

## Usage

1. Open `index.html` in a browser.
2. Drop your GraphQL introspection JSON file onto the upload area, or click the upload area to choose it.
3. Use the `EN` / `TR` language switch in the top bar when needed.
4. Select fields from the tree or field list to generate a query preview.

The loader accepts both common introspection shapes:

```json
{ "data": { "__schema": { "types": [] } } }
```

```json
{ "__schema": { "types": [] } }
```

## Files

- `index.html`: Static markup and app shell.
- `style.css`: Layout and UI styling.
- `app.js`: Schema loading, rendering, search, query generation, and language support.
- `schema.json`: Optional local schema file you can drag into the app.

## Turkish
GraphQL introspection JSON dosyalarını görsel olarak incelemek için statik bir araçtır. `index.html` dosyasını tarayıcıda açın, `schema.json` veya farklı bir introspection JSON dosyasını yükleme alanına sürükleyin. Arayüz varsayılan olarak İngilizcedir; üst bardaki `TR` düğmesiyle Türkçe'ye geçebilirsiniz.