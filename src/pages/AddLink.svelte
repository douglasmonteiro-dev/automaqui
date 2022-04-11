<script>
  import Alert from "../components/Alert.svelte";
  import { addlink } from "../actions/User";
  let loading = false;
  let status = -1;
  let mssg = "";
  let image =
    "https://www.lifewire.com/thmb/P856-0hi4lmA2xinYWyaEpRIckw=/1920x1326/filters:no_upscale():max_bytes(150000):strip_icc()/cloud-upload-a30f385a928e44e199a62210d578375a.jpg";
  let link = {
    url: "",
    title: "",
    image: "",
    description: "",
    clicks: 0,
    likes: 0,
  };
  const drop = async (e) => {
    loading = true;
    const files = e.target.files;
    const data = new FormData();
    data.append("file", files[0]);
    data.append("upload_preset", "kvssankar");
    const res = await fetch(
      "https://api.cloudinary.com/v1_1/sankarkvs/image/upload",
      {
        method: "POST",
        body: data,
      }
    );
    loading = false;
    const file = await res.json();
    link.image = file.secure_url;
    image = file.secure_url;
  };
  const dispatch = async (e) => {
    e.preventDefault();
    let res = await addlink(link);
    status = res.status;
    mssg = res.mssg;
    console.log(res);
    document.location.href = "/dashboard";
  };
</script>

<div class="main d-flex justify-content-center w-100">
  <main class="content d-flex p-0">
    <div class="container d-flex flex-column">
      <div class="row h-100">
        <div class="col-sm-10 col-md-8 col-lg-6 mx-auto d-table h-100">
          <div class="d-table-cell align-middle">
            <div class="text-center mt-4">
              <h1 class="h2">Criar página de produto ou serviço</h1>
              <p class="lead">Digite os detalhes</p>
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
                      <img
                        src={image}
                        alt="Not found user"
                        class="img-fluid"
                        width="132"
                        height="132"
                      />
                    {/if}
                  </div>
                  <form on:submit={dispatch}>
                    <div class="form-group">
                      <label for="">Titulo</label>
                      <input
                        class="form-control form-control-lg"
                        type="text"
                        bind:value={link.title}
                        required
                        placeholder="Produto ou Serviço"
                      />
                    </div>
                    <div class="form-group">
                      <label for="">Url</label>
                      <input
                        class="form-control form-control-lg"
                        type="text"
                        bind:value={link.url}
                        required
                        placeholder="https://vitrinedacasa.com.br/usuario/urldoproduto"
                      />
                    </div>
                    <div class="form-group">
                      <label for="">Descrição</label>
                      <textarea
                        class="form-control form-control-lg"
                        bind:value={link.description}
                        placeholder="Descreva o que você está oferecendo, seja objetivo com o seu cliente."
                      />
                    </div>
                    <div class="form-group">
                      <label for="">Carregue uma imagem (se desejar)</label>
                      <input
                        id="file"
                        name="file"
                        type="file"
                        on:change={drop}
                      />
                    </div>
                    <div class="text-center mt-3">
                      <button type="submit" class="btn btn-lg btn-primary"
                        >Criar Página</button
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
