import { redirect } from "next/navigation";

export default function NewRoomPage() {
  redirect("/dashboard?create=1");
}
