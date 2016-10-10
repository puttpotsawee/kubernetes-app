import _ from 'lodash';
import $ from 'jquery';

function extractContainerID(str) {
  var dockerIDPattern = /docker\:\/\/(.{12})/;
  return dockerIDPattern.exec(str)[1];
}

export class ClusterWorkloadsCtrl {
  /** @ngInject */
  constructor($scope, $injector, backendSrv, $q, $location, alertSrv) {
    var self = this;
    this.$q = $q;
    this.backendSrv = backendSrv;
    this.$location = $location;
    this.pageReady = false;
    this.cluster = {};
    this.componentStatuses = [];
    this.namespaces = [];
    this.namespace = "";
    this.daemonSets = [];
    this.replicationControllers = [];
    this.deployments = [];
    this.pods = [];
    if (!("cluster" in $location.search())) {
      alertSrv.set("no cluster specified.", "no cluster specified in url", 'error');
      return;
    }

    if ("namespace" in $location.search()) {
      this.namespace = $location.search().namespace;
    }

    self.getCluster($location.search().cluster)
    .then(() => {
      self.pageReady = true;
      self.getWorkloads();
    });
  }

  getWorkloads() {
    var self = this;
    this.getComponentStatuses().then(stats => {
      self.componentStatuses = stats.items;
    });
    this.getNamespaces().then(ns => {
      self.namespaces = ns.items;
    });
    this.getDaemonSets().then(ds => {
      self.daemonSets = ds.items;
    });
    this.getReplicationControllers().then(rc => {
      self.replicationControllers = rc.items;
    });
    this.getDeployments().then(deploy => {
      self.deployments = deploy.items;
    });
    this.getPods().then(pod => {
      self.pods = pod.items;
    });
  }

  getCluster(id) {
    var self = this;
    return this.backendSrv.get('api/datasources/'+id)
    .then((ds) => {
      self.cluster = ds;
    });
  }

  getComponentStatuses() {
    var self = this;
    return this.backendSrv.request({
      url: 'api/datasources/proxy/' + self.cluster.id + '/api/v1/componentstatuses',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  componentHealth(component) {
    var health = "unhealthy";
    _.forEach(component.conditions, function(condition) {
      if ((condition.type === "Healthy") && (condition.status === "True")) {
        health = "healthy";
      }
    });
    return health;
  }

  isComponentHealthy(component) {
    return this.componentHealth(component) === "healthy";
  }

  getNamespaces() {
    var self = this;
    return this.backendSrv.request({
      url: 'api/datasources/proxy/' + self.cluster.id + '/api/v1/namespaces',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  podDashboard(pod, evt) {
    var clickTargetIsLinkOrHasLinkParents = $(evt.target).closest('a').length > 0;
    if (clickTargetIsLinkOrHasLinkParents === false) {
      var containerIDs = _.map(pod.status.containerStatuses, (status) => {
        return extractContainerID(status.containerID);
      });
      this.$location.path("dashboard/db/kubernetes-container")
      .search({
        "var-datasource": this.cluster.jsonData.ds,
        "var-cluster": this.cluster.name,
        "var-node": pod.spec.nodeName,
        "var-container": containerIDs
      });
    }
  }

  podInfo(pod, evt) {
    var clickTargetIsLinkOrHasLinkParents = $(evt.target).closest('a').length > 0;

    var clickTargetClickAttr = _.find(evt.target.attributes, {name: "ng-click"});
    var clickTargetIsNodeDashboard = clickTargetClickAttr ? clickTargetClickAttr.value === "ctrl.podDashboard(pod, $event)" : false;
    if (clickTargetIsLinkOrHasLinkParents === false &&
        clickTargetIsNodeDashboard === false) {
      this.$location.path("plugins/raintank-kubernetes-app/page/pod-info")
      .search({
        "cluster": this.cluster.id,
        "namespace": pod.metadata.namespace,
        "pod": pod.metadata.name
      });
    }
  }

  getResource(prefix, resource) {
    var self = this;
    if (this.namespace) {
      resource = "namespaces/"+this.namespace+"/"+resource;
    }

    return this.backendSrv.request({
      url: 'api/datasources/proxy/' + self.cluster.id + prefix + resource,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  getDaemonSets() {
    return this.getResource("/apis/extensions/v1beta1/", "daemonsets");
  }

  getReplicationControllers() {
    return this.getResource("/api/v1/", "replicationcontrollers");
  }

  getDeployments() {
    return this.getResource("/apis/extensions/v1beta1/", "deployments");
  }

  getPods() {
    return this.getResource("/api/v1/", "pods");
  }
}

ClusterWorkloadsCtrl.templateUrl = 'components/clusters/cluster_workloads.html';