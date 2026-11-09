import { Redirect } from "expo-router";

export default function EntryScreen() {
  return <Redirect href={"/login" as never} />;
}
