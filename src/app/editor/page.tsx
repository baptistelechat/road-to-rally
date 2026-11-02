import type { Metadata } from "next";
import { EditorLoader } from "./EditorLoader";

export const metadata: Metadata = { title: "Éditeur · Rally" };

const EditorPage = () => <EditorLoader />;

export default EditorPage;
