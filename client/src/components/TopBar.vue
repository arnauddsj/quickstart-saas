<script setup lang="ts">
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useUserStore } from "@/stores/user";

const router = useRouter();
const userStore = useUserStore();
const { isLoggedIn } = storeToRefs(userStore);

const navigateToAccount = () => {
  if (isLoggedIn.value) {
    router.push("/account");
  } else {
    router.push("/auth");
  }
};
</script>

<template>
  <header class="top-bar">
    <a class="logo" href="/">
      <img src="@/assets/vue.svg" alt="Logo" />
      <span>QuickStart</span>
    </a>
    <nav>
      <button @click="navigateToAccount">
        {{ isLoggedIn ? "Account" : "Login" }}
      </button>
    </nav>
  </header>
</template>

<style scoped lang="scss">
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background-color: var(--primary-color98);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    img {
      width: 2rem;
      height: 2rem;
    }

    span {
      font-size: 1.2rem;
      font-weight: bold;
    }
  }

  nav {
    button {
      background-color: var(--accent-color);
      color: var(--primary-color15);
      border: none;
      padding: 0.5rem 1rem;
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: background-color 0.3s ease;

      &:hover {
        background-color: darken(#ebc846, 10%);
      }
    }
  }
}
</style>
