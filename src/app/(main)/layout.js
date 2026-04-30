import ChatExperience from "@/components/ChatExperience.jsx";

export default function MainAppLayout({ children }) {
  return (
    <>
      <ChatExperience />
      {children}
    </>
  );
}
