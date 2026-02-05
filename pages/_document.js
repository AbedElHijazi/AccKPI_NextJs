import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" href="/css/bootstrap.min.css" />
          <link rel="stylesheet" href="/css/fontawesome.min.css" />
          <link rel="stylesheet" href="/css/all.min.css" />
          <link rel="stylesheet" href="/css/brands.min.css" />
          <link rel="stylesheet" href="/css/regular.min.css" />
          <link rel="stylesheet" href="/css/solid.min.css" />
          <link rel="stylesheet" href="/styles/utils.css" />
        </Head>
        <body>
          <Main />
          <NextScript />
          <script src="/js/bootstrap.bundle.min.js"></script>
        </body>
      </Html>
    );
  }
}
