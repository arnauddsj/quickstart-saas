<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { trpc } from "@/services/server";
import { useUserStore } from "@/stores/user";
import ErrorMessage from "@/components/ErrorMessage.vue";
import AuthLayout from "@/layouts/AuthLayout.vue";

const email = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const sendMagicLink = async () => {
  try {
    await trpc.auth.sendMagicLink.mutate({ email: email.value });
    successMessage.value = "Magic link sent! Check your email.";
    errorMessage.value = "";
  } catch (error) {
    errorMessage.value = "Error sending magic link. Please try again.";
    successMessage.value = "";
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
  <AuthLayout>
    <div class="auth-container">
      <h1>Login</h1>
      <form @submit.prevent="sendMagicLink">
        <input v-model="email" type="email" placeholder="Enter your email" required />
        <button type="submit">Login with my email</button>
      </form>
      <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
      <ErrorMessage v-if="errorMessage" :message="errorMessage" />
    </div>
  </AuthLayout>
</template>

<style scoped lang="scss">
form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

input,
button {
  width: 100%;
}

.success-message {
  color: green;
  margin-top: 1rem;
}
</style>
