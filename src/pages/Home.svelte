<script>
  import { link } from "svelte-routing";
  import HomeNav from "../components/HomeNav.svelte";
  import Footer from "../components/Footer.svelte";
  const push = () => history.push("/create");
</script>

<HomeNav/>

<section class="landing-intro landing-bg pt-5 pt-lg-6 pb-5 pb-lg-7">
  <div class="landing-intro-content container">
    <div class="row align-items-center">
      <div class="col-lg-5 mx-auto">
        <span class="badge badge-soft-primary p-1">v1.0.0</span>

        <h1 class="my-4">Adicione vários links a sua bio do Instagram</h1>

        <p class="text-lg">
          Já tentou mudar o link na bio do seu instagram ?? Não mais !! <br/>
           Exiba todos os seus links em uma página com um URL personalizado.
           <br/> Este site possui painel personalizado para adicionar, excluir e editar
           seus links.
        </p>

        <!-- <div class="my-4">
          <div class="d-inline-block mr-3">
            <h2 class="text-dark">1k+</h2>
            <span class="text-muted">Users</span>
          </div>
          <div class="d-inline-block mr-3">
            <h2 class="text-dark">3.5k+</h2>
            <span class="text-muted">Links added</span>
          </div>
          <div class="d-inline-block">
            <h2 class="text-dark">45k+</h2>
            <span class="text-muted">Visits</span>
          </div>
        </div> -->
        <div class="my-4">
          <a
            href="/register"
            use:link
            replace
            class="btn btn-primary btn-lg mr-1">Criar</a
          >
          <a
            href="/login"
            use:link
            on:click={push}
            replace
            class="btn btn-outline-primary btn-lg mr-1">Entrar</a
          >
        </div>
      </div>
      <div class="col-lg-7 d-none d-lg-flex mx-auto text-center">
        <div class="landing-intro-screenshot pb-3">
          <img
            src="img/screenshots/mixed.jpg"
            alt="Dark/Light Bootstrap Admin Template"
            class="img-fluid"
          />
        </div>
      </div>
    </div>
  </div>
</section>

<Footer/>