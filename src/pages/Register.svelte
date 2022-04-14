<script>
  import Alert from "../components/Alert.svelte";
  import axios from "axios";
  import HomeNav from "../components/HomeNav.svelte";
  import Footer from "../components/Footer.svelte";
  import { userStore } from "../store/User.js";
  import { AvatarGenerator } from "random-avatar-generator";
  import ImageLoader from "../components/ImageLoader.svelte";
  const generator = new AvatarGenerator();
  let dp =
    "https://st3.depositphotos.com/4111759/13425/v/600/depositphotos_134255710-stock-illustration-avatar-vector-male-profile-gray.jpg";
  let user = {
    password: "",
    instagram: "",
    facebook: "",
    style: { 
      primary_color: "blue",
      secondary_color: "green",
      warning_color: "red",
      header_color: "lightgray",
      background_color: "white",
      text_color: "black",
      font_family: "roboto",
      font_size: "16"
    },
    twitter: "",
    email: "",
    dp: "",
  };
  let loading = false;

  function getPhoto(a) {
    loading = true;
    dp = generator.generateRandomAvatar();
    user.dp = dp;
    loading = false;
  }
  let status = -1;
  let mssg = "";
  const register = (e) => {
    console.log(JSON.stringify(user));
    e.preventDefault();
    fetch("/api/user/register", {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      mode: "cors", // no-cors, *cors, same-origin
      cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      credentials: "same-origin", // include, *same-origin, omit
      headers: {
        "Content-Type": "application/json",
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      redirect: "follow", // manual, *follow, error
      referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      body: JSON.stringify(user),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        mssg = "Registrado com Sucesso";
        status = 0;
        userStore.update((currUser) => {
          return { token: data.token, user: data.user };
        });
        document.location.href = "/dashboard";
      })
      .catch((error) => {
        console.error("Error:", error);
        status = 1;
        mssg = "Tivemos algum problema, por favor tente novamente";
      });
  };
</script>

<HomeNav />
<div class="main d-flex justify-content-center w-100">
  <main class="content d-flex p-0">
    <div class="container d-flex flex-column">
      <div class="row h-100">
        <div class="col-sm-10 col-md-8 col-lg-6 mx-auto d-table h-100">
          <div class="align-middle">
            <div class="text-center mt-4">
              <h1 class="h2">Vamos começar</h1>
              <p class="lead">
                Esse é o início de uma nova experiência com seus clientes.
              </p>
            </div>

            <div class="card">
              <div class="card-body">
                <div class="m-sm-4">
                  <div class="text-center">
                    {#if loading}
                      <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Carregando...</span>
                      </div>
                    {:else}
                      <ImageLoader src={dp} alt="Não encontrado" />
                    {/if}
                  </div>
                  <form on:submit={register}>
                    <div class="form-group">
                      <label for="">Nome do Usuário</label>
                      <input
                        class="form-control form-control-lg"
                        type="text"
                        bind:value={user.name}
                        required
                        placeholder="nome"
                      />
                    </div>
                    <div class="form-group">
                      <label for="">Usuário do Instagram</label>
                      <input
                        class="form-control form-control-lg"
                        type="text"
                        bind:value={user.instagram}
                        required
                        placeholder="usuario"
                      />
                    </div>
                    <div class="form-group">
                      <label for="">Nome da Fonte</label>
                      <input
                        class="form-control form-control-lg"
                        type="text"
                        bind:value={user.font_family}
                        required
                        placeholder="nome da fonte"/>
                    </div>
                    <div class="form-group">
                      <label for="">Tamanho da Fonte</label>
                      <input 
                        class="form-control form-control-lg"
                        type="number"
                        bind:value={user.font_size}
                        required
                        placeholder="tamanho da fonte em pixels"/>
                    </div>
                    <div class="form-group">
                      <label for="">Cor do Texto</label>
                      <input
                        class="form-control form-control-lg"
                        type="color"
                        bind:value={user.text_color}
                        required
                        placeholder="cor do texto"/>
                    </div>
                    
                    <div class="form-group">
                      <label for="">Cor do Cabeçalho</label>
                      <input
                        class="form-control form-control-lg"
                        type="color"
                        bind:value={user.style.header_color}
                        required
                        placeholder="cor"
                      />
                    </div>
                    <div class="form-group">
                      <label for="">Cor do Botão</label>
                      <input
                        class="form-control form-control-lg"
                        type="color"
                        bind:value={user.style.primary_color}
                        required
                        placeholder="cor"
                      />
                    </div>
                    <div class="form-group">
                      <label for="">Cor do Botão Secundário</label>
                      <input
                        class="form-control form-control-lg"
                        type="color"
                        bind:value={user.style.secondary_color}
                        required
                        placeholder="cor"
                      />
                    </div>
                    <div class="form-group">
                      <label for="">Cor do Botão de Alerta</label>
                      <input
                        class="form-control form-control-lg"
                        type="color"
                        bind:value={user.style.warning_color}
                        required
                        placeholder="cor"
                      />
                    </div>
                    
                    <div class="form-group">
                      <label for="">E-mail para recuperação</label>
                      <input
                        class="form-control form-control-lg"
                        type="text"
                        bind:value={user.email}
                        required
                        placeholder="usuario@gmail.com"
                      />
                    </div>
                    <div class="form-group">
                      <label for="">Facebook</label>
                      <input
                        class="form-control form-control-lg"
                        type="text"
                        bind:value={user.facebook}
                        placeholder="usuario"
                      />
                    </div>
                    <div class="form-group">
                      <label for="">Twitter</label>
                      <input
                        class="form-control form-control-lg"
                        type="text"
                        bind:value={user.twitter}
                        placeholder="usuario"
                      />
                    </div>
                    <div class="form-group">
                      <label for="">Senha</label>
                      <input
                        class="form-control form-control-lg"
                        type="password"
                        bind:value={user.password}
                        required
                        placeholder="Digite uma senha"
                      />
                    </div>
                    <div class="text-center mt-3">
                      <button type="submit" class="btn btn-lg btn-primary"
                        >Cadastre-se</button
                      >
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>

<Alert {mssg} {status} />
<Footer />
