name: RSS News Test

on:
  workflow_dispatch:

jobs:
  rss-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Check Node
        run: node --version

      - name: Check npm
        run: npm --version

      - name: Install dependencies
        run: npm install

      - name: Run RSS test
        run: node tests/rssFetcher.test.js