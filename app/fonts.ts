import { Readex_Pro, Reem_Kufi, Young_Serif } from "next/font/google";

const display = Young_Serif({ weight: "400", subsets: ["latin"], variable: "--font-young-serif" });
const displayAr = Reem_Kufi({ subsets: ["arabic"], variable: "--font-reem-kufi" });
const body = Readex_Pro({ subsets: ["latin", "arabic"], variable: "--font-readex" });

/** Font variables for the <html> of every root layout (site, admin, 404). */
export const fontVars = `${display.variable} ${displayAr.variable} ${body.variable}`;
