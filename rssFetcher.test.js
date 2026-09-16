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

      - name: Show Node version
        run: node --version

      - name: Show npm version
        run: npm --version

      - name: Install dependencies
        run: npm install

      - name: Run RSS test
        run: node tests/rssFetcher.test.js