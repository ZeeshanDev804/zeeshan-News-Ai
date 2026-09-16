name: RSS News Test

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  rss-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm install

      - name: Run RSS test
        run: node tests/rssFetcher.test.js