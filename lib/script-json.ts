/** JSON to embed in a <script> tag; escapes "<" so data can never close the tag early. */
export const scriptJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
