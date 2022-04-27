<script>
  import { onMount } from "svelte";
  export let user;
  let styles = {}
  onMount(async () => {
    console.log('user: ', user);
    styles = user.style;
  });
  $: cssVarStyles = Object.entries(styles)
		.map(([key, value]) => `--${key}:${value}`)
		.join(';');
</script>
<style>
  .navbar.landing-navbar {
    background: var(--header_color, #eff2f6)!important;
  }
  
</style>
<nav class="navbar navbar-expand-md navbar-light landing-navbar" style="{cssVarStyles}">
  <div class="container">
    <a class="navbar-brand landing-brand" href="/">
      <img src="{user ? user.logo : "/img/link.png"}" alt="vitrinedacasa" height="34px" />
      {user ? user.name : "Vitrine da Casa"}
    </a>

    <!-- <ul class="navbar-nav ml-auto">
      <li class="nav-item active">
        <a
          class="nav-link text-lg px-lg-3"
          href="https://github.com/vitrinedacasa"
          target="_blank"
        >
          <span class="d-inline-block d-md-none">GitHub</span>
          <span class="d-none d-md-inline-block">GitHub</span>
        </a>
      </li>
      <li class="nav-item active d-none d-md-inline-block">
              <a
                class="nav-link text-lg px-lg-3"
                href="mailto:support@bootlab.io"
                target="_blank">Support</a
              >
            </li>
    </ul>  -->
    <!-- <a
      href="/register"
      target="_blank"
      class="btn btn-lg btn-success my-2 my-sm-0 ml-3">Registrar</a
    > -->
  </div>
</nav>
<!-- <script>
  $: cssVarStyles = Object.entries(styles)
		.map(([key, value]) => `--${key}:${value}`)
		.join(';');
</script> -->