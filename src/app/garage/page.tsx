import type { Metadata } from "next";
import { GarageLoader } from "./GarageLoader";

export const metadata: Metadata = { title: "Garage · Rally" };

const GaragePage = () => <GarageLoader />;

export default GaragePage;
