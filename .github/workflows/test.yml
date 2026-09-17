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

  - name: Check Node.js
    run: node --version

  - name: Check npm
    run: npm --version

  - name: Install dependencies
    run: npm install --no-audit --no-fund

  - name: Run RSS test
    run: node tests/rssFetcher.test.js