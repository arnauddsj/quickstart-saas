<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { trpc } from "@/services/server";
import { useUserStore } from "@/stores/user";
import ErrorMessage from "@/components/ErrorMessage.vue";

const email = ref("");
const errorMessage = ref("");
const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const sendMagicLink = async () => {
  try {
    await trpc.auth.sendMagicLink.mutate({ email: email.value });
    errorMessage.value = "Magic link sent! Check your email.";
  } catch (error) {
    errorMessage.value = "Error sending magic link. Please try again.";
  }
};

onMounted(async () => {
  const token = route.query.token as string;
  if (token) {
    try {
      const result = await trpc.auth.verifyToken.mutate({ token });
      userStore.setUser(result.email);
      router.push("/");
    } catch (error) {
      errorMessage.value = "Invalid or expired token. Please try again.";
      await userStore.logout();
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
    <ErrorMessage v-if="errorMessage" :message="errorMessage" />
  </div>
</template>
