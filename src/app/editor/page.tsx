import type { Metadata } from "next";
import { EditorHome } from "./EditorHome";

export const metadata: Metadata = { title: "Éditeur · Rally" };

const EditorPage = () => <EditorHome />;

export default EditorPage;
