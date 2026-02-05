import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link href="/css/bootstrap.min.css" rel="stylesheet" />
          <link href="/css/fontawesome.min.css" rel="stylesheet" />
          <link href="/css/all.min.css" rel="stylesheet" />
          <link href="/styles/utils.css" rel="stylesheet" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
