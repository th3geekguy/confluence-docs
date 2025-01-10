
# Support Dump Explanation

How the support dump is structured and where to investigate for specific problems



## What is the "Support Dump"?

When our engineers refer to "support dump" or "support bundle" (sometimes abbreviated "SD"), we are referring to a collection tool written by our Mirantis developers that runs as a container within swarm and collects data about the cluster (both diagnostic and informative) for our perusal apart from the cluster. ([Docker Hub](https://hub.docker.com/r/mirantis/ucp-dsinfo) and [Github link (need permissions for this)](https://github.com/Mirantis/orca/tree/master/images/dsinfo))

In this way, we can have the customer run the program to create the support dump, attach it to a case and we are able to review it to see potential problems with the cluster and gain insight into how the cluster is setup.



## How does one collect the support dump?

There are two different types of support dumps the breadth or depth that they cover of the cluster:

1. A support dump that ends in a `.zip` extension is a cluster wide support dump and includes more than one node [^what is a node?]
2. A support dump that ends in a `.tgz` or `.tar.gz` extension is a node specific support dump and includes information on a single node

Collecting a support dump can be initiated through the web UI, API, or via CLI. When collected via CLI, the support dump will only be for that node (second type of support dump above).

To take the cluster wide support dump, use the link on the web UI under the profile name titled "support bundle". This will spin up a container using the `ucp-dsinfo` image and runs its associated scripts.

For a single node support dump, you can collect it via CLI with the following command:

```bash
MKE_VERSION=$((docker container inspect ucp-proxy \
--format '{{index .Config.Labels "com.docker.ucp.version"}}' \
2>/dev/null || echo -n 3.7.13)|tr -d [[:space:]]);

docker container run --rm \
  --name ucp \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --log-driver none \
  mirantis/ucp:${MKE_VERSION} \
  support > \
  docker-support-${HOSTNAME}-$(date +%Y%m%d-%H_%M_%S).tgz
```



## Which support dump do we want?

Ideally, have the customer take a cluster wide support dump. The cluster wide should contain everything a single node support dump would have (if it can collect for that node and doesn't lose connection to that node during collection).

In the case where the customer is 1) unable to take a cluster wide support dump (UI is down, for example) or 2) the affected node is not communicating properly with the rest of the cluster (network or swarm problems usually), a single node support dump of that node can be used to assess that node.



## How can we ensure we have a valid support dump?

At times, the support dump collection fails, whether through a network problem, because of the size of the support dump, or another reason. When this happens, the support dump will usually be under-sized, less than 2 MB.

We can also list the files within a support dump without decompressing using commands like:

```bash
less <docker-support.zip>
# -- or --
tar -tf <docker-support.tar.gz>
```

This can also immediately tell us if there is a problem with the file if it fails to print the file contents.



**Note:** We have also run into an issue with some customers collecting support dumps via the CLI for nodes and they add additional output to the headers of the file (I think it is likely how they output both stdout and the file to the same tgz). These files will appear to be corrupted .tar.gz archives and won't decompress, but we can fix with the following bash function:

```bash
fixtar ()
{
    if [ $# -eq 0 ]; then
        echo "This script will strip the leading text from a corrupted";
        echo "tar file created by a single node support dump";
        echo "  Usage: clean_sd.sh <filename>";
        echo "  Produces output file named fixed_<filename>";
        exit 0;
    fi;
    pos=$(grep -m 1 -a -b --only-matching '�' $1 | awk -F: '{print $1}');
    if [ -z "$pos" ]; then
        echo "Did not find gz header";
    else
        if [ $pos -eq 0 ]; then
            echo "File is already a tar/gz file";
        else
            pos=$(( pos+1 ));
            tail -c +$pos $1 > fixed_$1;
        fi;
    fi
}
```

And its usage:

```bash
fixtar <docker-support-corrupted.tar.gz>
# -- outputs a new file named like --
fixed_docker-support-correputed.tar.gz
```



## What is in the support dump?

### Node-specific Directories

Detailed information about each node's configuration, logs, and status, aiding in the identification of node-specific issues.

Each node directory contains:

- Directories for logs and inspection, including logs of all UCP containers and Docker inspection of all UCP containers.
- Journalctl logs and kernel logs, providing detailed system-level information.
- A Docker system info file, offering insights into Docker's configuration and environment.
- Certificate information, ensuring secure communication within the cluster.

### Inspection of Swarm Services

Detailed reports on the status, configuration, and health of all services in the Swarm cluster, crucial for diagnosing service-related issues.

### Kubernetes Descriptions

Comprehensive descriptions of all Kubernetes resources and nodes, offering insights into the Kubernetes cluster state.

### License Information

Details about the software licenses in use, ensuring compliance and providing context for available features.

### Docker System Info File

In-depth information about Docker's configuration and environment, aiding in Docker-related issue diagnosis.

### Primary Node Inspection File

Detailed information about the master node, including configuration and logs, offering insights into the overall cluster health.



## How do I go about reading the support dump?

The best first starting point is always to see an overview of the cluster. Below is a link to a script that has been written to pull info from the decompressed support dump and create a table view of the cluster, showing managers, OS, versions, etc.:

- [https://github.com/Mirantis/support-tools/blob/master/introspection/sd_nodes3os.py](https://github.com/Mirantis/support-tools/blob/master/introspection/sd_nodes3os.py)

Save this to your path so you can run: `sd_nodes` within a support dump and receive output like the following:

```
HOSTNAME          ID          ROLE     OS       AVAIL   STATE  IP               DAEMON  UCP/DTR  COLLECT  ORCHESTR    CREATED/UPDATED        STATUS_MESSAGE
----------------------------------------------------------------------------------------------------------------------------------------------------------------
prodvdockermke01  ckjwal2qir  leader   linux    active  ready  192.168.174.26   23.0.7  3.7.2/-  /System  swarm/kube  2024-05-10/2024-08-08  Healthy MKE manager
prodvdockermke02  5jyxz6hwcj  manager  linux    active  ready  192.168.174.27   23.0.7  3.7.2/-  /System  swarm/kube  2024-05-10/2024-08-08  Healthy MKE manager
prodvdockermke03  xxhforq6pt  manager  linux    active  ready  192.168.174.32   23.0.7  3.7.2/-  /System  swarm/kube  2024-05-10/2024-08-08  Healthy MKE manager
ProdVDockerInt2   snpiu4zlv3  worker   windows  active  ready  192.168.102.243  23.0.7  3.7.2/-  /Shared  swarm/-     2023-12-18/2024-08-08  Healthy MKE worker
prodvdockerintr   m6dhdclgn5  worker   windows  active  ready  192.168.102.242  23.0.7  3.7.2/-  /Shared  swarm/-     2021-06-07/2024-08-08  Healthy MKE worker
prodvdockermsr01  k7omkspmoo  worker   linux    active  ready  192.168.174.33   23.0.7  3.7.2/-  /Shared  -/kube      2024-05-09/2024-08-08  Healthy MKE worker
prodvdockermsr02  mzzrueeetc  worker   linux    active  ready  192.168.174.36   23.0.7  3.7.2/-  /Shared  -/kube      2024-05-09/2024-08-08  Healthy MKE worker
prodvdockermsr03  a2ocynm3hg  worker   linux    active  ready  192.168.174.37   23.0.7  3.7.2/-  /Shared  -/kube      2024-05-09/2024-08-08  Healthy MKE worker
prodvdockerwk01   tpbji95527  worker   windows  active  ready  192.168.174.7    23.0.7  3.7.2/-  /Shared  swarm/-     2021-06-07/2024-08-08  Healthy MKE worker
```



### Notes on SD_Nodes

- If versions for MKE and MSR are not reported, we failed to collect data for that node.
  - If a single version is not reported, that is not necessarily a problem.
- Status of `disconnected` or `drained` might not be a problem -- could be a node in maintenance.
- Some nodes may be on a different version versus others; again, this is not necessarily a problem; customer could be working through or towards an upgrade.
- Created and updated can tell you interesting info about the upgrade process/procedure of the cluster. Recent upgrades, etc.
- Mixed (swarm and kube) orchestration is only supported for managers and replicas; it is not meant for workers.



### Digging Deeper

- Investigation into the base file `ucp-controller-config.json` can tell you a lot about the overall configuration of MKE.
- If an MKE node is using Calico, we will additionally have a `cni` folder with info:
  - File `node_status.txt` (within `cni/calico`) gives a table overview of nodes using Calico, etc.
    - This tells a lot about the Calico process -- is it running? are the nodes connected? etc.
  - **Note** that some error messages here are red herrings
  - The `inspect` folder gives further health checks and info on the nodes
    - grep'ing inside this folder to "unhealthy" can give some information about node health and status
- The root of each node folder contains a `certdump` file
  - Examine this that all certificates are marked "valid"
  - An "invalid" certificate can indicate a time sync issue or drift, or an expired certificate
  - You can also run the certdump command directly on a live node
- On MKE managers, there is a `rethinkdb-status.json` file
  - This is great for troubleshooting the status of MKE
  - The file is sectioned as:
    - Part `server_status` denotes the number of managers (should be odd: 1, 3, or 5)
      - This shows connection statuses; ports; time connected
    - Part `table_status`:
      - Shows statuses of nodes ("ready", "not ready", etc)
- Node file `journalctl_kernel` is logging from syslogs
  - Represents system logs outside the Docker service and specific to the node's environment
  - Where system or kernel issues are the likely suspect, this journal is especially helpful
- File `journalctl_daemon` is the logs of the Docker service (MCR)
  - A shortened version is displayed when running `systemctl status docker`
- Really important file `dsinfo` has so much information (but it is not sorted) and the output of the following commands:
  - `docker info`
    - Versions
    - Storage Driver
      - Backing Filesystem
      - **Watch for** an incompatible setup of Docker and backing filesystem (see compatibility matrix in docs)
    - Logging Driver
    - Swarm status (we should see status "active"; a status of "pending" means there could be a certificate rotation in progress or node is waiting to join swarm)
    - Manager addresses (number of managers should match number of machines; seems obvious but I've seen mismatches)
    - OS and kernel
      - **Watch for** custom or mismatched kernels; this is not best practice and could cause problems
    - CPUs
      - **Watch for** nodes that don't meet requirements; we prefer 4 CPUs per manager.
    - Memory
      - **Watch for** nodes that don't meet requirements; we prefer 16 GB per manager node, and more for MSR replicas.
    - Docker root directory (this *is* customizable by customer)
    - Registries (aka, MSR or Docker Community Registry)
    - License (only on managers)
  - `docker images`
    - Can be used to verify an image exists and is the right version
    - **Note** that for clusters that are disconnected from the external internet (offline), every node needs the set of images locally to run associated containers (MKE and/or MSR)
  - `docker stats`
    - Can see the largest consumers of memory and CPU
    - **Note** that consumption of CPU over 100% is possible as Docker registers CPU usage funkily and doesn't account for multi-CPUs
  - `cat /etc/os-release`
  - `uname -r`
  - `lscpu`
  - `cat /proc/meminfo`
  - `df -h`
  - `mount`
  - `vmstat`
  - `iostat`
  - And a lot of network commands including iptables...



## Final Thoughts

Coupled with logs and/or screenshots provided of the specific issue the customer is running into, and SOS reports from nodes that might be having a system issue (`sosreport -e docker --batch`), this is usually enough information to at least identify a likely culprit -- if not identify the problem itself -- and/or escalate to our Mirantis engineers or developers to further investigate.

Overall, the support dump remains a vital tool for us as Mirantis engineers in understanding our customers' clusters.



[^what is a node?]: A node is a single machine within a cluster -- this could be virtual by way of a tool like VMWare, physical (like separate computers), or cloud based (like AWS). A cluster is a conglomerate of nodes (though you *can have a swarm of one node*)
