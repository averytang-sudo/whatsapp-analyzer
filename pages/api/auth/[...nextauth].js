import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

// List the specific Google emails allowed to access the tool
const ALLOWED_EMAILS = [
  "tanghokei@gmail.com", 
  "avery.tang@omnichat.ai",
  "shirley.lim@omnichat.ai",
  "shelly.chen@omnichat.ai"
];

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (ALLOWED_EMAILS.includes(user.email)) {
        return true; // Let them in
      } else {
        return false; // Block everyone else
      }
    },
  },
})