<script>
  import Card from "../components/Card.svelte";
  import HomeNav from "../components/HomeNav.svelte";
  import Footer from "../components/Footer.svelte";
  import { onMount } from "svelte";
  import { displayuser } from "../actions/User";
  import Loading from "../components/Loading.svelte";
  import axios from "axios";
  export let name;
  let user;
  let links = [];
  let styles = {};
  onMount(async () => {
    console.log(name);
    user = await displayuser(name);
    if (user === null) document.location.href = "notfound";
    links = user.links;
    styles['warning_color'] = user.style.warning_color;
    styles['background_color'] = user.style.background_color;
    styles['text_color'] = user.style.text_color;
    styles['font_family'] = user.style.font_family;
    styles['font_size'] = user.style.font_size;

    axios
      .post("/api/user/viewadd", { instagram: name })
      .then((res) => console.log("Done"));
  });
  $: cssVarStyles = Object.entries(styles)
		.map(([key, value]) => `--${key}:${value}`)
		.join(';');
</script>
<style>
  
  .btn-danger {
    background: var(--warning_color, #d9534f)!important;
  }
  .main {
    font-family: var(--font_family);
    color: var(--text_color);
    background: var(--background_color);
    font-size: var(--font_size)px;
  }
</style>
{#if user != null}
  <div class="main" style="{cssVarStyles}">
    <HomeNav {user} />
    <div class="content">
      <div class="row" style="justify-content:center">
        <div class="card mb-2" style="min-width:300px">
          <div class="card-header">
            <h5 class="card-title mb-0">Seja bem vindo</h5>
          </div>
          <div class="card-body text-center">
            <img
              src={user.dp}
              alt={user.instagram}
              class="img-fluid rounded-circle mb-2"
              width="128"
              height="128"
            />
            <h5 class="card-title mb-0">{user.instagram}</h5>
            <div class="text-muted mb-2">Itens Disponíveis : {user.total_links}</div>

            <div>
              <a
                class="btn btn-danger btn-sm"
                href={"https://www.instagram.com/" + user.instagram + "/"}
                ><span data-feather="instagram" />Instagram</a
              >
            </div>
          </div>
        </div>
      </div>
      <div class="row" style="justify-content: center;">
        {#each links as link}
          <Card {link} {name} {user}/>
        {/each}
      </div>
    </div>
    <Footer />
  </div>
{:else}
  <div class="row">
    <div style="margin-left:50%;margin-top:50vh;transform:translate(-50%,-50%)">
      <Loading />
    </div>
  </div>
{/if}
