import type { Metadata } from "next";
import { EditorLoader } from "./EditorLoader";

export const metadata: Metadata = { title: "Tracé · Éditeur · Rally" };

const EditorTracePage = () => <EditorLoader />;

export default EditorTracePage;
