<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { trpc } from "@/services/server";
import { useUserStore } from "@/stores/user";

const email = ref("");
const message = ref("");
const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const sendMagicLink = async () => {
  try {
    await trpc.auth.sendMagicLink.mutate({ email: email.value });
    message.value = "Magic link sent! Check your email.";
  } catch (error) {
    message.value = "Error sending magic link. Please try again.";
  }
};

onMounted(async () => {
  const token = route.query.token as string;
  if (token) {
    try {
      const result = await trpc.auth.verifyToken.mutate({ token });
      userStore.setUser(result.email);
      localStorage.setItem("authToken", token);
      router.push("/");
    } catch (error) {
      message.value = "Invalid or expired token. Please try again.";
      await userStore.logout();
      localStorage.removeItem("authToken");
    }
  }
});
</script>

<template>
  <div>
    <h1>Login or Sign Up</h1>
    <form @submit.prevent="sendMagicLink">
      <input v-model="email" type="email" placeholder="Enter your email" required />
      <button type="submit">Send Magic Link</button>
    </form>
    <p v-if="message">{{ message }}</p>
  </div>
</template>
